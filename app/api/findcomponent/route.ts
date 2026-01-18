import { NextRequest } from "next/server";
import type {
  ChatCompletion,
  ChatCompletionCreateParams,
} from "@cerebras/cerebras_cloud_sdk/resources/chat/completions";
import { cerebras, MODEL_ID } from "@/lib/cerebras/client";
import { findFileCandidates } from "@/lib/findfile/resolve";
import { repoSearch } from "@/lib/tools";
import {
  readFileSegment,
  listFunctionsInFile,
  findFunctionInFile,
} from "@/lib/findfile/tools";

type ToolMessage = ChatCompletionCreateParams.ToolMessageRequest;
type AssistantMessage = ChatCompletionCreateParams.AssistantMessageRequest;
type SystemMessage = ChatCompletionCreateParams.SystemMessageRequest;
type UserMessage = ChatCompletionCreateParams.UserMessageRequest;
type Message = SystemMessage | UserMessage | AssistantMessage | ToolMessage;

export const runtime = "nodejs";

interface FindComponentRequest {
  prompt: string;
}

interface ReturnComponentArgs {
  filePath: string;
  componentName: string;
  summary?: string;
}

interface ReturnErrorArgs {
  message: string;
}

interface ToolResult {
  done?: true;
  response?: Response;
  payload?: string;
}

const MAX_STEPS = 8;

const SYSTEM_PROMPT = `You are a codebase navigator. Use the provided tools to locate the React component that best matches the user's description.

Workflow:
1) Use search_files and grep_code to narrow candidate files.
2) Use read_file to inspect source.
3) Use list_functions and find_function to extract the component.
4) When you are confident, call return_component with the filePath and componentName. Provide a short summary if helpful.

Always use tools. Do not answer with plain text.`;

const makeTool = (
  name: string,
  description: string,
  parameters: unknown
): ChatCompletionCreateParams.Tool => ({
  type: "function",
  function: {
    name,
    description,
    parameters,
    strict: true,
  },
});

const TOOL_SEARCH_FILES = makeTool(
  "search_files",
  "Search for file paths in the repo by name or partial path. Returns a list of relative paths.",
  {
    type: "object",
    additionalProperties: false,
    required: ["query"],
    properties: {
      query: { type: "string" },
      limit: { type: "number", minimum: 1, maximum: 50 },
    },
  }
);

const TOOL_GREP_CODE = makeTool(
  "grep_code",
  "Search the codebase for text. Returns file/line matches.",
  {
    type: "object",
    additionalProperties: false,
    required: ["query"],
    properties: {
      query: { type: "string" },
      path: { type: "string" },
      glob: { type: "string" },
      maxResults: { type: "number", minimum: 1, maximum: 200 },
    },
  }
);

const TOOL_READ_FILE = makeTool(
  "read_file",
  "Read a file (optionally by line range).",
  {
    type: "object",
    additionalProperties: false,
    required: ["path"],
    properties: {
      path: { type: "string" },
      startLine: { type: "number", minimum: 1 },
      endLine: { type: "number", minimum: 1 },
    },
  }
);

const TOOL_LIST_FUNCTIONS = makeTool(
  "list_functions",
  "List function-like declarations in a file.",
  {
    type: "object",
    additionalProperties: false,
    required: ["path"],
    properties: {
      path: { type: "string" },
    },
  }
);

const TOOL_FIND_FUNCTION = makeTool(
  "find_function",
  "Find a specific function/component in a file by name.",
  {
    type: "object",
    additionalProperties: false,
    required: ["path", "name"],
    properties: {
      path: { type: "string" },
      name: { type: "string" },
    },
  }
);

const TOOL_RETURN_COMPONENT = makeTool(
  "return_component",
  "Return the selected component. The server will resolve the component source.",
  {
    type: "object",
    additionalProperties: false,
    required: ["filePath", "componentName"],
    properties: {
      filePath: { type: "string" },
      componentName: { type: "string" },
      summary: { type: "string" },
    },
  }
);

const TOOL_RETURN_ERROR = makeTool(
  "return_error",
  "Return an error message when the component cannot be found.",
  {
    type: "object",
    additionalProperties: false,
    required: ["message"],
    properties: {
      message: { type: "string" },
    },
  }
);

const TOOLS: ChatCompletionCreateParams.Tool[] = [
  TOOL_SEARCH_FILES,
  TOOL_GREP_CODE,
  TOOL_READ_FILE,
  TOOL_LIST_FUNCTIONS,
  TOOL_FIND_FUNCTION,
  TOOL_RETURN_COMPONENT,
  TOOL_RETURN_ERROR,
];

const isChatCompletionResponse = (
  res: ChatCompletion
): res is ChatCompletion.ChatCompletionResponse => {
  return "object" in res && res.object === "chat.completion";
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function handleToolCall(toolName: string, argsText: string): Promise<ToolResult> {
  let args: unknown;
  try {
    args = argsText ? JSON.parse(argsText) : {};
  } catch {
    return { payload: JSON.stringify({ error: "Invalid tool arguments." }) };
  }

  switch (toolName) {
    case "search_files": {
      const { query, limit } = args as { query?: string; limit?: number };
      const matches = query ? await findFileCandidates(query, limit ?? 20) : [];
      return { payload: JSON.stringify({ matches }) };
    }
    case "grep_code": {
      const { query, path, glob, maxResults } = args as {
        query?: string;
        path?: string;
        glob?: string;
        maxResults?: number;
      };
      if (!query) {
        return { payload: JSON.stringify({ matches: [] }) };
      }
      try {
        const result = await repoSearch({
          query,
          path: typeof path === "string" ? path : undefined,
          glob: typeof glob === "string" ? glob : undefined,
          maxResults: typeof maxResults === "number" ? maxResults : undefined,
        });
        return { payload: JSON.stringify(result) };
      } catch (error) {
        const message = error instanceof Error ? error.message : "repo_search failed";
        return { payload: JSON.stringify({ error: message, matches: [] }) };
      }
    }
    case "read_file": {
      const { path, startLine, endLine } = args as {
        path?: string;
        startLine?: number;
        endLine?: number;
      };
      const result = path ? await readFileSegment(path, startLine, endLine) : null;
      return {
        payload: JSON.stringify(result ?? { error: "Path is required for read_file." }),
      };
    }
    case "list_functions": {
      const { path } = args as { path?: string };
      const result = path ? await listFunctionsInFile(path) : null;
      return {
        payload: JSON.stringify(result ?? { error: "Path is required for list_functions." }),
      };
    }
    case "find_function": {
      const { path, name } = args as { path?: string; name?: string };
      const result = path && name ? await findFunctionInFile(path, name) : null;
      return {
        payload: JSON.stringify(
          result ?? { error: "Path and name are required for find_function." }
        ),
      };
    }
    case "return_component": {
      const { filePath, componentName, summary } = args as ReturnComponentArgs;
      if (!filePath || !componentName) {
        return {
          done: true,
          response: jsonResponse(
            { error: "filePath and componentName are required." },
            400
          ),
        };
      }

      const result = await findFunctionInFile(filePath, componentName);
      if (!result.matches || result.matches.length === 0) {
        return {
          done: true,
          response: jsonResponse(
            {
              error:
                result.error ??
                `Component "${componentName}" not found in ${filePath}.`,
              candidates: result.candidates ?? [],
              availableFunctions: result.availableFunctions ?? [],
            },
            404
          ),
        };
      }

      const match = result.matches[0];
      return {
        done: true,
        response: jsonResponse({
          filePath: result.filePath ?? filePath,
          componentName,
          componentText: match.text,
          matchKind: match.kind,
          startLine: match.startLine,
          startColumn: match.startColumn,
          matchCount: result.matches.length,
          summary: summary ?? null,
        }),
      };
    }
    case "return_error": {
      const { message } = args as ReturnErrorArgs;
      return {
        done: true,
        response: jsonResponse(
          { error: message || "Unable to find a matching component." },
          404
        ),
      };
    }
    default:
      return { payload: JSON.stringify({ error: "Unknown tool." }) };
  }
}

export async function POST(req: NextRequest) {
  let body: FindComponentRequest;
  try {
    body = (await req.json()) as FindComponentRequest;
  } catch {
    return jsonResponse({ error: "Invalid JSON payload." }, 400);
  }

  const prompt = body.prompt?.trim();
  if (!prompt) {
    return jsonResponse({ error: "Prompt is required." }, 400);
  }

  const messages: Message[] = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: prompt },
  ];

  for (let step = 0; step < MAX_STEPS; step += 1) {
    const response = await cerebras.chat.completions.create({
      model: MODEL_ID,
      messages,
      tools: TOOLS,
      tool_choice: "required",
      parallel_tool_calls: false,
      temperature: 0.2,
      max_tokens: 1200,
    });

    if (!isChatCompletionResponse(response)) {
      return jsonResponse({ error: "Unexpected response from Cerebras." }, 500);
    }

    const message = response.choices[0]?.message;
    if (!message) {
      return jsonResponse({ error: "No response message from Cerebras." }, 500);
    }

    const toolCalls = message.tool_calls ?? [];
    if (toolCalls.length === 0) {
      return jsonResponse({ error: "Model did not return tool calls." }, 500);
    }

    messages.push({
      role: "assistant",
      content: message.content ?? null,
      tool_calls: toolCalls,
    });

    for (const toolCall of toolCalls) {
      const toolName = toolCall.function?.name;
      const argsText = toolCall.function?.arguments ?? "";
      if (!toolName) {
        continue;
      }

      const result = await handleToolCall(toolName, argsText);
      if (result.done && result.response) {
        return result.response;
      }

      messages.push({
        role: "tool",
        tool_call_id: toolCall.id,
        content: result.payload ?? "",
      });
    }
  }

  return jsonResponse({ error: "Tool loop exceeded maximum steps." }, 500);
}
