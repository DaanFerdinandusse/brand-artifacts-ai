import Cerebras from "@cerebras/cerebras_cloud_sdk";
import type {
  ChatCompletion,
  ChatCompletionCreateParams,
} from "@cerebras/cerebras_cloud_sdk/resources/chat/completions";

if (!process.env.CEREBRAS_API_KEY) {
  throw new Error("Missing CEREBRAS_API_KEY environment variable");
}

export const cerebras = new Cerebras({
  apiKey: process.env.CEREBRAS_API_KEY,
});

export const MODEL_ID = "zai-glm-4.7";

type MessageRole = "system" | "user" | "assistant" | "tool";

interface Message {
  role: MessageRole;
  content: string;
}

// Type guard for ChatCompletionResponse
const isChatCompletionResponse = (
  res: ChatCompletion
): res is ChatCompletion.ChatCompletionResponse => {
  return "object" in res && res.object === "chat.completion";
};

function makeFunctionTool(
  name: string,
  description: string,
  parameters: unknown
): ChatCompletionCreateParams.Tool {
  return {
    type: "function",
    function: {
      name,
      description,
      parameters,
      strict: true,
    },
  };
}

export const TOOL_RETURN_SVG = makeFunctionTool(
  "return_svg",
  "Return one SVG string (a complete <svg>...</svg>).",
  {
    type: "object",
    additionalProperties: false,
    required: ["svg"],
    properties: {
      svg: { type: "string" },
    },
  }
);

export const TOOL_RETURN_SVG_VARIANTS = makeFunctionTool(
  "return_svg_variants",
  "Return exactly 4 SVG variants.",
  {
    type: "object",
    additionalProperties: false,
    required: ["svgs"],
    properties: {
      svgs: {
        type: "array",
        minItems: 4,
        maxItems: 4,
        items: { type: "string" },
      },
    },
  }
);

export const TOOL_RETURN_PROMPT_VARIANTS = makeFunctionTool(
  "return_prompt_variants",
  "Return exactly 4 refined prompt variants.",
  {
    type: "object",
    additionalProperties: false,
    required: ["prompts"],
    properties: {
      prompts: {
        type: "array",
        minItems: 4,
        maxItems: 4,
        items: { type: "string" },
      },
    },
  }
);

export const TOOL_RETURN_CRITIQUE = makeFunctionTool(
  "return_critique",
  "Return a short critique string.",
  {
    type: "object",
    additionalProperties: false,
    required: ["critique"],
    properties: {
      critique: { type: "string" },
    },
  }
);

export async function generateToolCallArgs<TArgs>(
  messages: Message[],
  tool: ChatCompletionCreateParams.Tool,
  options?: {
    temperature?: number;
    maxTokens?: number;
  }
): Promise<TArgs> {
  const toolName = tool.function.name;

  const enforcedSystemMessage: Message = {
    role: "system",
    content: `You MUST call the tool function "${toolName}". You MUST NOT write any assistant text content.`,
  };

  const formattedMessages = [enforcedSystemMessage, ...messages].map((msg) => ({
    content: msg.content,
    role: msg.role as "system" | "user" | "assistant" | "tool",
  }));

  const response = await cerebras.chat.completions.create({
    model: MODEL_ID,
    messages: formattedMessages,
    temperature: options?.temperature ?? 0.7,
    max_tokens: options?.maxTokens ?? 4000,
    tools: [tool],
    tool_choice: { type: "function", function: { name: toolName } },
  });

  if (!isChatCompletionResponse(response)) {
    throw new Error("Unexpected response type from Cerebras chat completion");
  }

  const toolCalls = response.choices[0]?.message?.tool_calls ?? [];
  const toolCall =
    toolCalls.find((call) => call.function?.name === toolName) ?? toolCalls[0];

  if (!toolCall?.function?.arguments) {
    throw new Error(`Model did not call tool "${toolName}"`);
  }

  return JSON.parse(toolCall.function.arguments) as TArgs;
}

export async function generateCompletion(
  messages: Message[],
  options?: {
    temperature?: number;
    maxTokens?: number;
  }
): Promise<string> {
  // Convert messages to the format expected by Cerebras SDK
  const formattedMessages = messages.map((msg) => ({
    content: msg.content,
    role: msg.role as "system" | "user" | "assistant",
  }));

  const response = await cerebras.chat.completions.create({
    model: MODEL_ID,
    messages: formattedMessages,
    temperature: options?.temperature ?? 0.7,
    max_tokens: options?.maxTokens ?? 4000,
  });

  if (isChatCompletionResponse(response)) {
    const content = response.choices[0]?.message?.content;
    if (content) {
      return content;
    }
  }

  throw new Error("No content in response");
}
