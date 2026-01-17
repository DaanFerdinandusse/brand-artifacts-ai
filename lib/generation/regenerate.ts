import { generateCompletion } from "@/lib/cerebras/client";
import {
  getCritiquePrompt,
  getRegenerateWithCritiquePrompt,
  STRICTER_PROMPTS,
} from "@/lib/cerebras/prompts";
import { extractSvgsFromJson } from "@/lib/svg/sanitizer";

interface RegenerateCallbacks {
  onCritique?: (critique: string) => void;
  onVariantComplete?: (index: number, svg: string) => void;
}

export async function regenerateWithCritique(
  originalPrompt: string,
  rejectedSvgs: string[],
  callbacks?: RegenerateCallbacks
): Promise<string[]> {
  // Step 1: Generate critique of rejected SVGs
  const critiquePrompt = getCritiquePrompt(originalPrompt, rejectedSvgs);

  let critique: string;
  try {
    critique = await generateCompletion(
      [{ role: "user", content: critiquePrompt }],
      { temperature: 0.5 } // Lower temperature for more focused critique
    );
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
    critique
  );

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= 3; attempt++) {
    const finalPrompt =
      attempt > 0
        ? `${regeneratePrompt}\n\n${STRICTER_PROMPTS[attempt - 1]}`
        : regeneratePrompt;

    try {
      const response = await generateCompletion(
        [{ role: "user", content: finalPrompt }],
        { temperature: Math.max(0.4, 0.7 - attempt * 0.1) } // Reduce temperature on retries
      );

      const svgs = extractSvgsFromJson(response);

      if (svgs.length === 0) {
        throw new Error("No valid SVGs extracted from response");
      }

      // Notify progress for each SVG
      svgs.forEach((svg, index) => {
        callbacks?.onVariantComplete?.(index, svg);
      });

      // Ensure we have exactly 4 variants
      while (svgs.length < 4) {
        svgs.push(svgs[svgs.length - 1] || '<svg viewBox="0 0 24 24"></svg>');
      }

      return svgs.slice(0, 4);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.log(`Regenerate attempt ${attempt + 1} failed:`, lastError.message);
    }
  }

  throw lastError || new Error("Failed to regenerate SVGs after retries");
}
