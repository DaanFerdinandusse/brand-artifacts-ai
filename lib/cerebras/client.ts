import Cerebras from "@cerebras/cerebras_cloud_sdk";
import type { ChatCompletion } from "@cerebras/cerebras_cloud_sdk/resources/chat/completions";

if (!process.env.CEREBRAS_API_KEY) {
  throw new Error("Missing CEREBRAS_API_KEY environment variable");
}

export const cerebras = new Cerebras({
  apiKey: process.env.CEREBRAS_API_KEY,
});

export const MODEL_ID = "zai-glm-4.7";

type MessageRole = "system" | "user" | "assistant";

interface Message {
  role: MessageRole;
  content: string;
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

  // Type guard for ChatCompletionResponse
  const isChatCompletionResponse = (
    res: ChatCompletion
  ): res is ChatCompletion.ChatCompletionResponse => {
    return "object" in res && res.object === "chat.completion";
  };

  if (isChatCompletionResponse(response)) {
    const content = response.choices[0]?.message?.content;
    if (content) {
      return content;
    }
  }

  throw new Error("No content in response");
}
