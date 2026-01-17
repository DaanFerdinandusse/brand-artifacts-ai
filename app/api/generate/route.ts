import { NextRequest } from "next/server";
import { generateSingle } from "@/lib/generation/single";
import type { GenerateEvent, GenerationRequest } from "@/lib/cerebras/types";

export async function POST(req: NextRequest) {
  const body = (await req.json()) as GenerationRequest;
  const { prompt, selectedSvg, variantCount = 4 } = body;

  if (!prompt || typeof prompt !== "string") {
    return new Response(JSON.stringify({ error: "Prompt is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: GenerateEvent) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };

      try {
        const safeVariantCount = Math.min(8, Math.max(1, Number(variantCount) || 4));
        send({ type: "started", variantCount: safeVariantCount });

        const variants = await generateSingle(
          prompt,
          selectedSvg,
          safeVariantCount,
          (index, svg) => {
            send({ type: "variant_complete", index, svg });
          }
        );

        send({ type: "complete", variants });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        send({ type: "error", message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
