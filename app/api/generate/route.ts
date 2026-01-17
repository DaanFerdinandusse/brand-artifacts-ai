import { NextRequest } from "next/server";
import { generateSingle } from "@/lib/generation/single";
import { generateParallel } from "@/lib/generation/parallel";
import type { GenerateEvent, GenerationRequest } from "@/lib/cerebras/types";

export async function POST(req: NextRequest) {
  const body = (await req.json()) as GenerationRequest;
  const { prompt, mode = "single", selectedSvg } = body;

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
        send({ type: "started", mode });

        let variants: string[];

        if (mode === "parallel") {
          // Parallel mode: generate 4 prompt variants, then 4 SVGs in parallel
          variants = await generateParallel(prompt, selectedSvg, {
            onVariantComplete: (index, svg) => {
              send({ type: "variant_complete", index, svg });
            },
            onVariantError: (index, error, retrying) => {
              send({ type: "variant_error", index, error, retrying });
            },
          });
        } else {
          // Single mode: one API call that returns 4 SVGs
          variants = await generateSingle(prompt, selectedSvg, (index, svg) => {
            send({ type: "variant_complete", index, svg });
          });
        }

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
