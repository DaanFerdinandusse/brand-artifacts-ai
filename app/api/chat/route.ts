import { NextRequest } from "next/server";
import { openai } from "@/lib/openai";
import { repoSearch, readFile } from "@/lib/tools";

export const runtime = "nodejs";

const MODEL_ID = "gpt-5.2";
const MAX_ITERS = 5;

const SYSTEM_PROMPT = `You are a codebase component locator.
Use repo_search to find candidate files.
Use read_file to fetch real code.
Only return a component after you have read it with read_file.
Never fabricate file contents or paths.
If nothing is found, return foundFilePath = null and suggest next queries.
Output a final JSON object with:
- foundFilePath (string or null)
- componentName (string or null)
- componentStartLine (number or null, 1-based line number where the component starts)
- componentEndLine (number or null, 1-based line number where the component ends)
- componentCode (string or null, copied from read_file output for that exact range)
- reasoningSummary (short)
- confidence ("low" | "medium" | "high")
- suggestedNextQueries (array, only when not found).
When you identify the exact component range, call read_file with startLine/endLine and use that output as componentCode.
componentCode should include only the component definition (with its export), not unrelated imports or other components.`;

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
    description: "Fetch the component code from disk.",
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

type ToolTraceEntry =
  | {
      tool: "repo_search";
      args: Record<string, unknown>;
      resultCount: number;
    }
  | {
      tool: "read_file";
      args: Record<string, unknown>;
    };

type FunctionCallItem = {
  type: "function_call";
  name: string;
  arguments: string;
  call_id: string;
};

function inferComponentName(code: string): string | null {
  const patterns = [
    /export\s+default\s+function\s+([A-Za-z][A-Za-z0-9_]*)/m,
    /export\s+default\s+class\s+([A-Za-z][A-Za-z0-9_]*)/m,
    /export\s+default\s+([A-Za-z][A-Za-z0-9_]*)/m,
    /export\s+function\s+([A-Za-z][A-Za-z0-9_]*)/m,
    /export\s+const\s+([A-Za-z][A-Za-z0-9_]*)/m,
    /export\s+class\s+([A-Za-z][A-Za-z0-9_]*)/m,
    /function\s+([A-Za-z][A-Za-z0-9_]*)/m,
    /const\s+([A-Za-z][A-Za-z0-9_]*)\s*=/m,
  ];

  for (const pattern of patterns) {
    const match = code.match(pattern);
    if (match?.[1]) {
      return match[1];
    }
  }

  if (/export\s+default\s+/m.test(code)) {
    return "default";
  }

  return null;
}

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

function parseNullableNumber(value: unknown): number | null {
  const asNumber = Number(value);
  if (!Number.isFinite(asNumber)) {
    return null;
  }
  return asNumber;
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

export async function POST(req: NextRequest) {
  const body = (await req.json()) as { description?: string };
  const description = body?.description;

  if (!description || typeof description !== "string") {
    return Response.json({ error: "description is required" }, { status: 400 });
  }

  const toolTrace: ToolTraceEntry[] = [];
  const readFileCache = new Map<string, string[]>();

  try {
    let response = await openai.responses.create({
      model: MODEL_ID,
      input: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: description },
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
            toolTrace.push({
              tool: "repo_search",
              args,
              resultCount: result.matches.length,
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
            const existing = readFileCache.get(result.path) ?? [];
            existing.push(result.content);
            readFileCache.set(result.path, existing);
            toolTrace.push({
              tool: "read_file",
              args,
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
      return Response.json(
        {
          foundFilePath: null,
          componentName: null,
          componentStartLine: null,
          componentEndLine: null,
          componentCode: null,
          confidence: "low",
          reasoningSummary: "Failed to parse model response.",
          suggestedNextQueries: [],
          toolTrace,
        },
        { status: 200 }
      );
    }

    const foundFilePath =
      typeof parsed.foundFilePath === "string" ? parsed.foundFilePath : null;
    let componentName =
      typeof parsed.componentName === "string" ? parsed.componentName : null;
    const parsedStartLine = parseNullableNumber(parsed.componentStartLine);
    const parsedEndLine = parseNullableNumber(parsed.componentEndLine);

    let componentCode =
      typeof parsed.componentCode === "string" ? parsed.componentCode : null;
    let componentStartLine = parsedStartLine;
    let componentEndLine = parsedEndLine;

    if (
      foundFilePath &&
      componentStartLine !== null &&
      componentEndLine !== null
    ) {
      try {
        const extracted = await readFile({
          path: foundFilePath,
          startLine: componentStartLine,
          endLine: componentEndLine,
        });
        componentCode = extracted.content;
        componentStartLine = extracted.startLine;
        componentEndLine = extracted.endLine;
      } catch {
        componentCode = null;
      }
    } else if (foundFilePath && componentCode) {
      const cached = readFileCache.get(foundFilePath) ?? [];
      const found = cached.find((snippet) => snippet.includes(componentCode ?? ""));
      if (!found) {
        componentCode = null;
      }
    }

    if (!componentName && componentCode) {
      componentName = inferComponentName(componentCode);
    }

    return Response.json(
      {
        foundFilePath,
        componentName,
        componentStartLine,
        componentEndLine,
        componentCode,
        confidence: parsed.confidence ?? "low",
        reasoningSummary: parsed.reasoningSummary ?? "",
        suggestedNextQueries: parsed.suggestedNextQueries ?? [],
        toolTrace,
      },
      { status: 200 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return Response.json({ error: message }, { status: 500 });
  }
}
