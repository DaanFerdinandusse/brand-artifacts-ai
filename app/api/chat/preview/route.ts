import { NextRequest } from "next/server";
import path from "node:path";
import fs from "node:fs/promises";
import * as esbuild from "esbuild";
import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";
import { openai } from "@/lib/openai";
import { repoSearch, readFile } from "@/lib/tools";
import { resolveUserFilePath } from "@/lib/findfile/resolve";

export const runtime = "nodejs";

const MODEL_ID = "gpt-5.2";
const MAX_ITERS = 4;
const ROOT_DIR = process.cwd();

interface PreviewRequest {
  foundFilePath: string;
  componentName?: string | null;
  componentCode?: string | null;
  description?: string;
  props?: Record<string, unknown>;
}

interface WrapperSpec {
  filePath: string;
  exportName?: string;
  props?: Record<string, unknown>;
}

interface PreviewPlan {
  renderFilePath: string;
  renderExport: string;
  props?: Record<string, unknown>;
  wrappers?: WrapperSpec[];
  bodyClassName?: string;
  reasoningSummary?: string;
  confidence?: "low" | "medium" | "high";
}

type FunctionCallItem = {
  type: "function_call";
  name: string;
  arguments: string;
  call_id: string;
};

function getFunctionCalls(response: unknown): FunctionCallItem[] {
  if (!response || typeof response !== "object") {
    return [];
  }
  const output = (response as { output?: unknown }).output;
  if (!Array.isArray(output)) {
    return [];
  }
  return output.filter((item) => {
    if (!item || typeof item !== "object") {
      return false;
    }
    return (item as { type?: string }).type === "function_call";
  }) as FunctionCallItem[];
}

function getOutputText(response: unknown): string {
  if (!response || typeof response !== "object") {
    return "";
  }
  const outputText = (response as { output_text?: unknown }).output_text;
  if (typeof outputText === "string") {
    return outputText;
  }
  const output = (response as { output?: unknown }).output;
  if (!Array.isArray(output)) {
    return "";
  }
  const chunks: string[] = [];
  for (const item of output) {
    if (!item || typeof item !== "object") {
      continue;
    }
    if ((item as { type?: string }).type !== "message") {
      continue;
    }
    const content = (item as { content?: unknown }).content;
    if (!Array.isArray(content)) {
      continue;
    }
    for (const part of content) {
      if (part && typeof part === "object" && (part as { type?: string }).type === "output_text") {
        const text = (part as { text?: unknown }).text;
        if (typeof text === "string") {
          chunks.push(text);
        }
      }
    }
  }
  return chunks.join("");
}

function parseJson(text: string): Record<string, unknown> | null {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) {
    return null;
  }
  try {
    return JSON.parse(match[0]) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function parseArguments(raw: unknown): Record<string, unknown> {
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  if (raw && typeof raw === "object") {
    return raw as Record<string, unknown>;
  }
  return {};
}

function normalizePath(value: string): string {
  return value.replace(/\\/g, "/");
}

function toImportPath(relativePath: string): string {
  const normalized = normalizePath(relativePath);
  return normalized.startsWith(".") ? normalized : `./${normalized}`;
}

function sanitizeScriptContent(value: string): string {
  return value.replace(/<\/script>/gi, "<\\/script>");
}

function sanitizeStyleContent(value: string): string {
  return value.replace(/<\/style>/gi, "<\\/style>");
}

function truncateText(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }
  return `${value.slice(0, maxLength)}...`;
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    const stats = await fs.stat(filePath);
    return stats.isFile();
  } catch {
    return false;
  }
}

const RESOLVE_EXTENSIONS = [".tsx", ".ts", ".jsx", ".js", ".mjs", ".cjs"];

async function resolveFileWithExtensions(basePath: string): Promise<string | null> {
  if (await fileExists(basePath)) {
    return basePath;
  }

  for (const ext of RESOLVE_EXTENSIONS) {
    const candidate = `${basePath}${ext}`;
    if (await fileExists(candidate)) {
      return candidate;
    }
  }

  for (const ext of RESOLVE_EXTENSIONS) {
    const candidate = path.join(basePath, `index${ext}`);
    if (await fileExists(candidate)) {
      return candidate;
    }
  }

  return null;
}

const LAYOUT_CANDIDATES = ["layout.tsx", "layout.ts", "layout.jsx", "layout.js"];

async function findLayoutChain(relativePath: string): Promise<string[]> {
  const normalized = normalizePath(relativePath);
  const segments = normalized.split("/");
  const appIndex = segments.indexOf("app");
  if (appIndex === -1) {
    return [];
  }

  const appRoot = path.join(ROOT_DIR, ...segments.slice(0, appIndex + 1));
  const fileDir = path.join(ROOT_DIR, ...segments.slice(0, -1));
  const layouts: string[] = [];
  let currentDir = fileDir;

  while (true) {
    for (const candidate of LAYOUT_CANDIDATES) {
      const layoutPath = path.join(currentDir, candidate);
      if (await fileExists(layoutPath)) {
        const relativeLayout = normalizePath(path.relative(ROOT_DIR, layoutPath));
        if (relativeLayout !== normalized) {
          layouts.push(relativeLayout);
        }
        break;
      }
    }

    if (path.resolve(currentDir) === path.resolve(appRoot)) {
      break;
    }

    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) {
      break;
    }
    currentDir = parentDir;
  }

  return layouts.reverse();
}

function deriveRouteParams(relativePath: string): Record<string, string | string[]> {
  const normalized = normalizePath(relativePath);
  const segments = normalized.split("/");
  const appIndex = segments.indexOf("app");
  if (appIndex === -1) {
    return {};
  }

  const params: Record<string, string | string[]> = {};
  for (const segment of segments.slice(appIndex + 1, -1)) {
    if (!segment || segment.startsWith("(") || segment.startsWith("@")) {
      continue;
    }

    if (segment.startsWith("[[...") && segment.endsWith("]]")) {
      const key = segment.slice(5, -2);
      if (key) {
        params[key] = [];
      }
      continue;
    }

    if (segment.startsWith("[...") && segment.endsWith("]")) {
      const key = segment.slice(4, -1);
      if (key) {
        params[key] = ["preview"];
      }
      continue;
    }

    if (segment.startsWith("[") && segment.endsWith("]")) {
      const key = segment.slice(1, -1);
      if (key) {
        params[key] = "preview";
      }
    }
  }

  return params;
}

function extractBodyClassName(source: string): string | null {
  const patterns = [
    /<body[^>]*className\s*=\s*["']([^"']+)["']/m,
    /<body[^>]*className\s*=\s*{\s*["']([^"']+)["']\s*}/m,
    /<body[^>]*className\s*=\s*{\s*`([^`]+)`\s*}/m,
    /<body[^>]*class\s*=\s*["']([^"']+)["']/m,
  ];

  for (const pattern of patterns) {
    const match = source.match(pattern);
    if (match?.[1]) {
      return match[1];
    }
  }

  return null;
}

async function findBodyClassName(layoutPaths: string[]): Promise<string | null> {
  for (const layoutPath of layoutPaths) {
    try {
      const fullPath = path.join(ROOT_DIR, layoutPath);
      const content = await fs.readFile(fullPath, "utf8");
      const bodyClass = extractBodyClassName(content);
      if (bodyClass) {
        return bodyClass;
      }
    } catch {
      continue;
    }
  }
  return null;
}

function mergeClassNames(...values: Array<string | null | undefined>): string | null {
  const classes = values
    .flatMap((value) => (value ? value.split(/\s+/) : []))
    .filter(Boolean);
  if (classes.length === 0) {
    return null;
  }
  return Array.from(new Set(classes)).join(" ");
}

function stripTailwindDirectives(css: string): string {
  return css
    .split("\n")
    .filter((line) => {
      if (/^\s*@import\s+["']tailwindcss/.test(line)) {
        return false;
      }
      if (/^\s*@tailwind\b/.test(line)) {
        return false;
      }
      return true;
    })
    .join("\n");
}

function parseWrapperSpecs(raw: unknown): WrapperSpec[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const wrappers: WrapperSpec[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") {
      continue;
    }
    const filePath = (entry as { filePath?: unknown }).filePath;
    if (typeof filePath !== "string" || !filePath.trim()) {
      continue;
    }
    const exportName = (entry as { exportName?: unknown }).exportName;
    const props = (entry as { props?: unknown }).props;
    wrappers.push({
      filePath: filePath.trim(),
      exportName: typeof exportName === "string" ? exportName : undefined,
      props: props && typeof props === "object" ? (props as Record<string, unknown>) : undefined,
    });
  }
  return wrappers;
}

async function resolveWrapperSpec(wrapper: WrapperSpec): Promise<WrapperSpec | null> {
  const rawPath = wrapper.filePath.startsWith("@/")
    ? wrapper.filePath.slice(2)
    : wrapper.filePath;
  const resolved = await resolveUserFilePath(rawPath);
  if (!resolved.file) {
    return null;
  }
  return {
    filePath: normalizePath(resolved.file.relativePath),
    exportName: wrapper.exportName,
    props: wrapper.props,
  };
}

async function mergeWrappers(
  layoutWrappers: WrapperSpec[],
  plannedWrappers: WrapperSpec[]
): Promise<WrapperSpec[]> {
  const resolvedWrappers: WrapperSpec[] = [];
  const seen = new Map<string, number>();

  for (const wrapper of layoutWrappers) {
    const resolved = await resolveWrapperSpec(wrapper);
    if (!resolved) {
      continue;
    }
    const key = resolved.filePath;
    if (seen.has(key)) {
      continue;
    }
    seen.set(key, resolvedWrappers.length);
    resolvedWrappers.push(resolved);
  }

  for (const wrapper of plannedWrappers) {
    const resolved = await resolveWrapperSpec(wrapper);
    if (!resolved) {
      continue;
    }
    const key = resolved.filePath;
    if (seen.has(key)) {
      const index = seen.get(key);
      if (typeof index === "number") {
        resolvedWrappers[index] = resolved;
      }
      continue;
    }
    seen.set(key, resolvedWrappers.length);
    resolvedWrappers.push(resolved);
  }

  return resolvedWrappers;
}
function buildEntry(options: {
  importPath: string;
  exportName: string;
  propsJson: string;
  wrappers: WrapperSpec[];
  bodyClassName?: string | null;
}): string {
  const wrapperImports = options.wrappers
    .map(
      (wrapper, index) =>
        `import * as WrapperModule${index} from ${JSON.stringify(wrapper.filePath)};`
    )
    .join("\n");

  const wrapperLookups = options.wrappers
    .map((wrapper, index) => {
      const exportName = wrapper.exportName ?? "default";
      return `const Wrapper${index} = WrapperModule${index}[${JSON.stringify(
        exportName
      )}] ?? WrapperModule${index}.default;`;
    })
    .join("\n");

  const wrapperProps = options.wrappers
    .map((wrapper, index) => {
      const props = wrapper.props ?? {};
      return `const wrapperProps${index} = ${JSON.stringify(props)};`;
    })
    .join("\n");

  const wrapperChecks = options.wrappers
    .map((wrapper, index) => {
      const exportName = wrapper.exportName ?? "default";
      return `if (!Wrapper${index}) {
  throw new Error("Wrapper \\"${exportName}\\" not found in ${wrapper.filePath}.");
}`;
    })
    .join("\n");

  const wrapperCompose =
    options.wrappers.length > 0
      ? `
const wrappers = [${options.wrappers.map((_, index) => `Wrapper${index}`).join(", ")}];
const wrapperPropsList = [${options.wrappers
  .map((_, index) => `wrapperProps${index}`)
  .join(", ")}];
let wrappedElement = React.createElement(Component, props);
for (let i = wrappers.length - 1; i >= 0; i -= 1) {
  const wrapper = wrappers[i];
  const wrapperProps = wrapperPropsList[i] ?? {};
  wrappedElement = React.createElement(wrapper, { ...wrapperProps, children: wrappedElement });
}
`
      : "const wrappedElement = React.createElement(Component, props);";

  const bodyClassName = options.bodyClassName ?? "";
  const bodyClassScript = bodyClassName
    ? `
const bodyClasses = ${JSON.stringify(bodyClassName)}.split(/\\s+/).filter(Boolean);
bodyClasses.forEach((cls) => document.body.classList.add(cls));
`
    : "";

  return `
import React from "react";
import { createRoot } from "react-dom/client";
import * as Module from ${JSON.stringify(options.importPath)};
${wrapperImports}

const Component = Module[${JSON.stringify(options.exportName)}] ?? Module.default;
const props = ${options.propsJson};
const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Preview root element not found.");
}

if (!Component) {
  const exportsList = Object.keys(Module).filter((key) => key !== "__esModule");
  throw new Error(
    "Component \\"${options.exportName}\\" not found. Exports: " + exportsList.join(", ")
  );
}

${wrapperLookups}
${wrapperProps}
${wrapperChecks}
${bodyClassScript}
${wrapperCompose}

const root = createRoot(rootElement);
root.render(wrappedElement);
`;
}

function buildHtml(payload: { js: string; css?: string; propsJson: string }): string {
  const js = sanitizeScriptContent(payload.js);
  const css = payload.css ? sanitizeStyleContent(payload.css) : "";

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      html, body { margin: 0; padding: 0; font-family: system-ui, sans-serif; }
      #root { min-height: 100vh; padding: 16px; box-sizing: border-box; }
    </style>
    ${css ? `<style>${css}</style>` : ""}
  </head>
  <body>
    <div id="root"></div>
    <script>
      window.__COMPONENT_PROPS__ = ${payload.propsJson};
      (function () {
        function reportError(message, stack) {
          var payload = {
            type: "component-preview-error",
            message: String(message || "Preview error"),
            stack: stack || null
          };
          if (window.parent && window.parent !== window) {
            window.parent.postMessage(payload, "*");
          }
        }
        window.addEventListener("error", function (event) {
          reportError(event.message, event.error && event.error.stack);
        });
        window.addEventListener("unhandledrejection", function (event) {
          var reason = event.reason || "Unhandled promise rejection";
          var message = reason && reason.message ? reason.message : String(reason);
          reportError(message, reason && reason.stack);
        });
      })();
    </script>
    <script>${js}</script>
  </body>
</html>`;
}

const nextStubPlugin: esbuild.Plugin = {
  name: "next-stubs",
  setup(build) {
    build.onResolve({ filter: /^next\/link$/ }, () => ({
      path: "next/link",
      namespace: "next-stub",
    }));
    build.onResolve({ filter: /^next\/image$/ }, () => ({
      path: "next/image",
      namespace: "next-stub",
    }));
    build.onResolve({ filter: /^next\/head$/ }, () => ({
      path: "next/head",
      namespace: "next-stub",
    }));
    build.onResolve({ filter: /^next\/navigation$/ }, () => ({
      path: "next/navigation",
      namespace: "next-stub",
    }));
    build.onResolve({ filter: /^next\/router$/ }, () => ({
      path: "next/router",
      namespace: "next-stub",
    }));

    build.onLoad({ filter: /.*/, namespace: "next-stub" }, (args) => {
      if (args.path === "next/link") {
        return {
          loader: "tsx",
          contents: `
import React from "react";
export default function Link({ href, children, ...props }) {
  const url = typeof href === "string" ? href : "#";
  return React.createElement("a", { href: url, ...props }, children);
}
`,
        };
      }

      if (args.path === "next/image") {
        return {
          loader: "tsx",
          contents: `
import React from "react";
export default function Image({ src, alt, ...props }) {
  return React.createElement("img", { src, alt, ...props });
}
`,
        };
      }

      if (args.path === "next/head") {
        return {
          loader: "tsx",
          contents: `
export default function Head() { return null; }
`,
        };
      }

      if (args.path === "next/navigation") {
        return {
          loader: "ts",
          contents: `
export function useRouter() {
  return { push() {}, replace() {}, back() {}, forward() {}, prefetch() {} };
}
export function usePathname() { return ""; }
export function useSearchParams() { return new URLSearchParams(); }
export function notFound() { throw new Error("notFound() is not supported in preview"); }
`,
        };
      }

      if (args.path === "next/router") {
        return {
          loader: "ts",
          contents: `
export function useRouter() {
  return { push() {}, replace() {}, back() {}, forward() {}, prefetch() {} };
}
`,
        };
      }

      return null;
    });
  },
};

const tailwindImportStubPlugin: esbuild.Plugin = {
  name: "tailwind-import-stub",
  setup(build) {
    build.onResolve({ filter: /^tailwindcss(\/.*)?$/ }, (args) => ({
      path: args.path,
      namespace: "tailwind-import-stub",
    }));
    build.onLoad({ filter: /.*/, namespace: "tailwind-import-stub" }, () => ({
      loader: "css",
      contents: "",
    }));
  },
};

const styleStubPlugin: esbuild.Plugin = {
  name: "style-stub",
  setup(build) {
    build.onResolve({ filter: /\.(scss|sass|less)$/ }, (args) => ({
      path: args.path,
      namespace: "style-stub",
    }));
    build.onLoad({ filter: /.*/, namespace: "style-stub" }, () => ({
      loader: "js",
      contents: "export default {};",
    }));
  },
};

const aliasPlugin: esbuild.Plugin = {
  name: "alias-plugin",
  setup(build) {
    build.onResolve({ filter: /^@\// }, async (args) => {
      const basePath = path.resolve(ROOT_DIR, args.path.slice(2));
      const resolvedPath = await resolveFileWithExtensions(basePath);
      if (resolvedPath) {
        return { path: resolvedPath };
      }
      return { path: basePath };
    });
  },
};

const tools = [
  {
    type: "function",
    name: "repo_search",
    description: "Search the codebase for candidate files that match the description.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search string or regex pattern" },
        path: {
          type: "string",
          description: "Relative folder to search from",
          default: ".",
        },
        glob: {
          type: "string",
          description: "Optional file glob, e.g. **/*.{ts,tsx,js,jsx}",
          default: "**/*",
        },
        maxResults: { type: "integer", default: 30 },
      },
      required: ["query"],
    },
  },
  {
    type: "function",
    name: "read_file",
    description: "Fetch file contents from disk.",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string", description: "Relative path to the file" },
        startLine: { type: "integer", description: "1-based start line", default: 1 },
        endLine: { type: "integer", description: "1-based end line", default: 200 },
      },
      required: ["path"],
    },
  },
];

async function buildPreviewPlan(
  input: PreviewRequest
): Promise<PreviewPlan> {
  const fallback: PreviewPlan = {
    renderFilePath: input.foundFilePath,
    renderExport: input.componentName || "default",
    props: input.props ?? {},
    confidence: "low",
    reasoningSummary: "Fallback to the candidate component.",
  };

  const systemPrompt = `You are a preview planner for UI components.
Given a component candidate, find the best file to render so the preview matches the app.
Use repo_search to locate usage sites (prefer app/ pages or parent components).
Use read_file to inspect usage context and note any provider/layout dependencies.
If no usage is found, fall back to the candidate component itself.
Return JSON:
- renderFilePath (string)
- renderExport (string, "default" or named export)
- props (object, optional)
- wrappers (optional array of wrapper components required for the same render; each item: { filePath, exportName, props })
- bodyClassName (optional string from layout body class)
- reasoningSummary (short)
- confidence ("low" | "medium" | "high")`;

  let response = await openai.responses.create({
    model: MODEL_ID,
    input: [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: `Candidate component:
- filePath: ${input.foundFilePath}
- componentName: ${input.componentName ?? "unknown"}
- description: ${input.description ?? "n/a"}
- componentCode: ${
          input.componentCode
            ? `\n${truncateText(input.componentCode, 2000)}`
            : "n/a"
        }`,
      },
    ],
    tools,
  });

  for (let iter = 0; iter < MAX_ITERS; iter += 1) {
    const toolCalls = getFunctionCalls(response);
    if (toolCalls.length === 0) {
      break;
    }

    const toolOutputs = [];
    for (const call of toolCalls) {
      const args = parseArguments(call.arguments);
      if (call.name === "repo_search") {
        try {
          const result = await repoSearch({
            query: String(args.query ?? ""),
            path: typeof args.path === "string" ? args.path : undefined,
            glob: typeof args.glob === "string" ? args.glob : undefined,
            maxResults: typeof args.maxResults === "number" ? args.maxResults : undefined,
          });
          toolOutputs.push({
            type: "function_call_output",
            call_id: call.call_id,
            output: JSON.stringify(result),
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : "repo_search failed";
          toolOutputs.push({
            type: "function_call_output",
            call_id: call.call_id,
            output: JSON.stringify({ error: message }),
          });
        }
      } else if (call.name === "read_file") {
        try {
          const result = await readFile({
            path: String(args.path ?? ""),
            startLine: typeof args.startLine === "number" ? args.startLine : undefined,
            endLine: typeof args.endLine === "number" ? args.endLine : undefined,
          });
          toolOutputs.push({
            type: "function_call_output",
            call_id: call.call_id,
            output: JSON.stringify(result),
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : "read_file failed";
          toolOutputs.push({
            type: "function_call_output",
            call_id: call.call_id,
            output: JSON.stringify({ error: message }),
          });
        }
      } else {
        toolOutputs.push({
          type: "function_call_output",
          call_id: call.call_id,
          output: JSON.stringify({ error: `Unknown tool: ${call.name}` }),
        });
      }
    }

    response = await openai.responses.create({
      model: MODEL_ID,
      tools,
      previous_response_id: response.id,
      input: toolOutputs,
    });
  }

  const outputText = getOutputText(response);
  const parsed = parseJson(outputText);
  if (!parsed) {
    return fallback;
  }

  const renderFilePath =
    typeof parsed.renderFilePath === "string" ? parsed.renderFilePath : fallback.renderFilePath;
  const renderExport =
    typeof parsed.renderExport === "string" ? parsed.renderExport : fallback.renderExport;
  const props =
    parsed.props && typeof parsed.props === "object"
      ? (parsed.props as Record<string, unknown>)
      : fallback.props;
  const wrappers = parseWrapperSpecs(parsed.wrappers);
  const bodyClassName =
    typeof parsed.bodyClassName === "string" ? parsed.bodyClassName : undefined;

  return {
    renderFilePath,
    renderExport,
    props,
    wrappers,
    bodyClassName,
    reasoningSummary:
      typeof parsed.reasoningSummary === "string" ? parsed.reasoningSummary : fallback.reasoningSummary,
    confidence:
      parsed.confidence === "high" || parsed.confidence === "medium" || parsed.confidence === "low"
        ? parsed.confidence
        : fallback.confidence,
  };
}

async function buildTailwindCss(): Promise<string> {
  const globalsPath = path.join(ROOT_DIR, "app", "globals.css");
  let baseCss = "";
  try {
    baseCss = await fs.readFile(globalsPath, "utf8");
  } catch {
    baseCss = '@import "tailwindcss";';
  }

  if (!baseCss.includes("@import \"tailwindcss\"")) {
    baseCss = `@import "tailwindcss";\n${baseCss}`;
  }

  const result = await postcss([tailwind({ base: ROOT_DIR })]).process(baseCss, {
    from: globalsPath,
  });

  return result.css;
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function POST(req: NextRequest) {
  let body: PreviewRequest;
  try {
    body = (await req.json()) as PreviewRequest;
  } catch {
    return jsonResponse({ error: "Invalid JSON payload." }, 400);
  }

  const foundFilePath = body.foundFilePath?.trim();
  if (!foundFilePath) {
    return jsonResponse({ error: "foundFilePath is required." }, 400);
  }

  let plan: PreviewPlan;
  try {
    plan = await buildPreviewPlan(body);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Preview planning failed.";
    return jsonResponse({ error: message }, 500);
  }

  const resolved = await resolveUserFilePath(plan.renderFilePath);
  if (!resolved.file) {
    return jsonResponse(
      {
        error: resolved.error ?? "Unable to resolve file path.",
        candidates: resolved.candidates ?? [],
      },
      resolved.candidates ? 409 : 404
    );
  }

  const relativePath = normalizePath(resolved.file.relativePath);
  const derivedParams = deriveRouteParams(relativePath);
  const baseProps: Record<string, unknown> = plan.props ? { ...plan.props } : {};

  if (Object.keys(derivedParams).length > 0 && baseProps.params == null) {
    baseProps.params = derivedParams;
  }
  if (baseProps.searchParams == null) {
    baseProps.searchParams = {};
  }

  let propsJson = "{}";
  try {
    propsJson = JSON.stringify(baseProps);
  } catch {
    return jsonResponse({ error: "Props must be JSON-serializable." }, 400);
  }

  const layoutChain = await findLayoutChain(relativePath);
  const layoutBodyClassName = await findBodyClassName(layoutChain);
  const bodyClassName = mergeClassNames(layoutBodyClassName, plan.bodyClassName);

  const layoutWrappers: WrapperSpec[] = layoutChain.map((layoutPath) => ({
    filePath: layoutPath,
    exportName: "default",
    props: Object.keys(derivedParams).length > 0 ? { params: derivedParams } : undefined,
  }));

  const plannedWrappers = plan.wrappers ?? [];
  const mergedWrappers = await mergeWrappers(layoutWrappers, plannedWrappers);
  const wrapperImports = mergedWrappers.map((wrapper) => {
    const props = wrapper.props ? { ...wrapper.props } : {};
    if (Object.keys(derivedParams).length > 0 && props.params == null) {
      props.params = derivedParams;
    }
    return {
      ...wrapper,
      filePath: toImportPath(wrapper.filePath),
      props,
    };
  });

  const importPath = toImportPath(relativePath);

  const entryContents = buildEntry({
    importPath,
    exportName: plan.renderExport,
    propsJson,
    wrappers: wrapperImports,
    bodyClassName,
  });

  let jsText = "";
  let cssText = "";
  try {
    const result = await esbuild.build({
      bundle: true,
      write: false,
      platform: "browser",
      format: "iife",
      target: ["es2018"],
      jsx: "automatic",
      resolveExtensions: [".tsx", ".ts", ".jsx", ".js"],
      metafile: true,
      outdir: path.join(ROOT_DIR, ".preview"),
      loader: {
        ".css": "css",
        ".md": "text",
      },
      define: {
        "process.env.NODE_ENV": '"production"',
      },
      plugins: [aliasPlugin, nextStubPlugin, tailwindImportStubPlugin, styleStubPlugin],
      stdin: {
        contents: entryContents,
        resolveDir: ROOT_DIR,
        sourcefile: "component-preview-entry.tsx",
        loader: "tsx",
      },
    });

    const outputFiles = result.outputFiles ?? [];
    const jsFile =
      outputFiles.find((file) => file.path.endsWith(".js")) ?? outputFiles[0];
    const cssFile = outputFiles.find((file) => file.path.endsWith(".css"));

    if (!jsFile) {
      return jsonResponse({ error: "Preview bundle failed." }, 500);
    }

    jsText = jsFile.text;
    cssText = stripTailwindDirectives(cssFile?.text ?? "");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Preview build failed.";
    return jsonResponse({ error: message }, 500);
  }

  let tailwindCss = "";
  try {
    tailwindCss = await buildTailwindCss();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Tailwind build failed.";
    return jsonResponse({ error: message }, 500);
  }

  const combinedCss = [tailwindCss, cssText].filter(Boolean).join("\n");
  const html = buildHtml({ js: jsText, css: combinedCss, propsJson });

  return jsonResponse({ html });
}
