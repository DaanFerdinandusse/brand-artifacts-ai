import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { IconSpecSchema, IconSpec } from "@/app/lib/iconSpec/schema";

const client = new Anthropic();

const SYSTEM_PROMPT = `You are an expert icon designer. Your task is to generate IconSpec JSON that defines SVG icons.

You MUST respond with ONLY valid JSON matching this exact schema - no markdown, no explanation, just the JSON object:

{
  "docType": "icon",
  "name": string (lowercase, no spaces, use underscores),
  "preset": "outline_rounded" | "outline_sharp" | "solid" | "duotone",
  "size": 24,
  "viewBox": "0 0 24 24",
  "strokeWidth": 2 (use 2 for outline presets, 0 for solid),
  "stroke": "currentColor" (use "currentColor" for outlines, "none" for solid),
  "fill": "none" (use "none" for outlines, "currentColor" for solid),
  "paths": [{ "d": string (SVG path data) }],
  "circles": [{ "cx": number, "cy": number, "r": number }] (optional),
  "rects": [{ "x": number, "y": number, "width": number, "height": number, "rx": number }] (optional),
  "lines": [{ "x1": number, "y1": number, "x2": number, "y2": number }] (optional),
  "exports": { "svg": true, "png": [64, 128, 256] }
}

Design guidelines:
- Use a 24x24 viewBox coordinate system
- Keep icons simple and recognizable
- Use clean, smooth path data
- For outline style: use stroke-based paths with strokeWidth 2
- For solid style: use filled paths with no stroke
- Ensure paths are centered and well-balanced
- Use standard icon conventions (e.g., 2px stroke, rounded corners for outline_rounded)

Respond with ONLY the JSON object, nothing else.`;

const MAX_RETRIES = 2;

async function generateIconSpec(
  prompt: string,
  retryCount = 0
): Promise<IconSpec> {
  const message = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: `Create an icon for: ${prompt}`,
      },
    ],
    system: SYSTEM_PROMPT,
  });

  const content = message.content[0];
  if (content.type !== "text") {
    throw new Error("Unexpected response type");
  }

  let jsonText = content.text.trim();

  // Try to extract JSON if wrapped in markdown code blocks
  const jsonMatch = jsonText.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    jsonText = jsonMatch[1].trim();
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    if (retryCount < MAX_RETRIES) {
      console.log(`JSON parse failed, retrying (${retryCount + 1}/${MAX_RETRIES})...`);
      return generateIconSpec(prompt, retryCount + 1);
    }
    throw new Error(`Failed to parse JSON response: ${jsonText.slice(0, 200)}`);
  }

  const result = IconSpecSchema.safeParse(parsed);
  if (!result.success) {
    if (retryCount < MAX_RETRIES) {
      console.log(`Validation failed, retrying (${retryCount + 1}/${MAX_RETRIES})...`);
      console.log("Validation errors:", result.error.issues);
      return generateIconSpec(prompt, retryCount + 1);
    }
    throw new Error(`Invalid IconSpec: ${result.error.message}`);
  }

  return result.data;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { prompt } = body;

    if (!prompt || typeof prompt !== "string") {
      return NextResponse.json(
        { error: "Missing or invalid prompt" },
        { status: 400 }
      );
    }

    const iconSpec = await generateIconSpec(prompt);

    return NextResponse.json({ iconSpec });
  } catch (error) {
    console.error("Icon generation error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
