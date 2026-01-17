import { NextRequest } from "next/server";
import { regenerateWithCritique } from "@/lib/generation/regenerate";
import type { GenerateEvent, RegenerateRequest } from "@/lib/cerebras/types";

export async function POST(req: NextRequest) {
  const body = (await req.json()) as RegenerateRequest;
  const { originalPrompt, rejectedSvgs, mode = "single" } = body;

  if (!originalPrompt || typeof originalPrompt !== "string") {
    return new Response(
      JSON.stringify({ error: "Original prompt is required" }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  if (!rejectedSvgs || !Array.isArray(rejectedSvgs) || rejectedSvgs.length === 0) {
    return new Response(
      JSON.stringify({ error: "Rejected SVGs are required" }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: GenerateEvent) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };

      try {
        send({ type: "started", mode });

        const variants = await regenerateWithCritique(
          originalPrompt,
          rejectedSvgs,
          {
            onCritique: (critique) => {
              send({ type: "critique", critique });
            },
            onVariantComplete: (index, svg) => {
              send({ type: "variant_complete", index, svg });
            },
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
