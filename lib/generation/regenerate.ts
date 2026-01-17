import {
  generateToolCallArgs,
  TOOL_RETURN_CRITIQUE,
  TOOL_RETURN_SVG_VARIANTS,
} from "@/lib/cerebras/client";
import {
  getCritiquePrompt,
  getRegenerateWithCritiquePrompt,
  STRICTER_PROMPTS,
} from "@/lib/cerebras/prompts";
import { sanitizeSvg } from "@/lib/svg/sanitizer";

interface RegenerateCallbacks {
  onCritique?: (critique: string) => void;
  onVariantComplete?: (index: number, svg: string) => void;
}

export async function regenerateWithCritique(
  originalPrompt: string,
  rejectedSvgs: string[],
  variantCount: number = 4,
  callbacks?: RegenerateCallbacks
): Promise<string[]> {
  // Step 1: Generate critique of rejected SVGs
  const critiquePrompt = getCritiquePrompt(originalPrompt, rejectedSvgs);

  let critique: string;
  try {
    const result = await generateToolCallArgs<{ critique: string }>(
      [{ role: "user", content: critiquePrompt }],
      TOOL_RETURN_CRITIQUE,
      { temperature: 0.5 } // Lower temperature for more focused critique
    );
    critique = result.critique;
    callbacks?.onCritique?.(critique);
  } catch (error) {
    // If critique fails, use a generic message and continue
    critique =
      "The icons may not have matched the user's expectations in style or clarity.";
    callbacks?.onCritique?.(critique);
  }

  // Step 2: Generate new SVGs with critique context
  const regeneratePrompt = getRegenerateWithCritiquePrompt(
    originalPrompt,
    critique,
    variantCount
  );

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= 3; attempt++) {
    const finalPrompt =
      attempt > 0
        ? `${regeneratePrompt}\n\n${STRICTER_PROMPTS[attempt - 1]}`
        : regeneratePrompt;

    try {
      const { svgs: rawSvgs } = await generateToolCallArgs<{ svgs: string[] }>(
        [{ role: "user", content: finalPrompt }],
        TOOL_RETURN_SVG_VARIANTS,
        { temperature: Math.max(0.4, 0.7 - attempt * 0.1) } // Reduce temperature on retries
      );

      const svgs = rawSvgs
        .map((svg) => sanitizeSvg(svg))
        .filter(Boolean) as string[];

      if (svgs.length === 0) {
        throw new Error("No valid SVGs returned from tool call");
      }

      const limitedSvgs = svgs.slice(0, variantCount);

      // Notify progress for each SVG
      limitedSvgs.forEach((svg, index) => {
        callbacks?.onVariantComplete?.(index, svg);
      });

      // Ensure we have exactly the requested number of variants
      while (limitedSvgs.length < variantCount) {
        limitedSvgs.push(
          limitedSvgs[limitedSvgs.length - 1] || '<svg viewBox="0 0 24 24"></svg>'
        );
      }

      return limitedSvgs;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.log(`Regenerate attempt ${attempt + 1} failed:`, lastError.message);
    }
  }

  throw lastError || new Error("Failed to regenerate SVGs after retries");
}
