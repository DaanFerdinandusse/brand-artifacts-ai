import { NextRequest } from "next/server";
import path from "node:path";
import fs from "node:fs/promises";
import * as esbuild from "esbuild";
import { resolveUserFilePath } from "@/lib/findfile/resolve";

export const runtime = "nodejs";

interface PreviewRequest {
  filePath: string;
  componentName: string;
  props?: Record<string, unknown>;
}

const ROOT_DIR = process.cwd();

function normalizePath(value: string): string {
  return value.replace(/\\/g, "/");
}

function sanitizeScriptContent(value: string): string {
  return value.replace(/<\/script>/gi, "<\\/script>");
}

function sanitizeStyleContent(value: string): string {
  return value.replace(/<\/style>/gi, "<\\/style>");
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

function buildEntry(importPath: string, componentName: string): string {
  return `
import React from "react";
import { createRoot } from "react-dom/client";
import * as Module from ${JSON.stringify(importPath)};

const Component = Module[${JSON.stringify(componentName)}] ?? Module.default;
const props = window.__COMPONENT_PROPS__ ?? {};
const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Preview root element not found.");
}

if (!Component) {
  const exportsList = Object.keys(Module).filter((key) => key !== "__esModule");
  throw new Error(
    "Component \\\"${componentName}\\\" not found. Exports: " + exportsList.join(", ")
  );
}

const root = createRoot(rootElement);
root.render(React.createElement(Component, props));
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

const styleStubPlugin: esbuild.Plugin = {
  name: "style-stub",
  setup(build) {
    build.onResolve({ filter: /\.(css|scss|sass|less)$/ }, (args) => ({
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

  const filePath = body.filePath?.trim();
  const componentName = body.componentName?.trim();

  if (!filePath || !componentName) {
    return jsonResponse({ error: "filePath and componentName are required." }, 400);
  }

  const resolved = await resolveUserFilePath(filePath);
  if (!resolved.file) {
    return jsonResponse(
      {
        error: resolved.error ?? "Unable to resolve file path.",
        candidates: resolved.candidates ?? [],
      },
      resolved.candidates ? 409 : 404
    );
  }

  let propsJson = "{}";
  if (body.props) {
    try {
      propsJson = JSON.stringify(body.props);
    } catch {
      return jsonResponse({ error: "Props must be JSON-serializable." }, 400);
    }
  }

  const relativePath = normalizePath(resolved.file.relativePath);
  const importPath = relativePath.startsWith(".")
    ? relativePath
    : `./${relativePath}`;

  const entryContents = buildEntry(importPath, componentName);

  try {
    const result = await esbuild.build({
      bundle: true,
      write: false,
      platform: "browser",
      format: "iife",
      target: ["es2018"],
      jsx: "automatic",
      resolveExtensions: [".tsx", ".ts", ".jsx", ".js"],
      define: {
        "process.env.NODE_ENV": '"production"',
      },
      plugins: [aliasPlugin, nextStubPlugin, styleStubPlugin],
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

    const html = buildHtml({
      js: jsFile.text,
      css: cssFile?.text,
      propsJson,
    });

    return jsonResponse({ html });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Preview build failed.";
    return jsonResponse({ error: message }, 500);
  }
}
