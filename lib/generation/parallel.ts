import {
  generateToolCallArgs,
  TOOL_RETURN_PROMPT_VARIANTS,
  TOOL_RETURN_SVG,
} from "@/lib/cerebras/client";
import {
  getVariantGenerationPrompt,
  getSingleSvgPrompt,
  getIterationSingleSvgPrompt,
  VARIANT_SYSTEM_PROMPT,
  STRICTER_PROMPTS,
} from "@/lib/cerebras/prompts";
import { sanitizeSvg } from "@/lib/svg/sanitizer";

interface ProgressCallback {
  onVariantComplete: (index: number, svg: string) => void;
  onVariantError: (index: number, error: string, retrying: boolean) => void;
}

/**
 * Generate diverse prompt variants from a user prompt
 */
async function generatePromptVariants(
  userPrompt: string,
  variantCount: number
): Promise<string[]> {
  const prompt = getVariantGenerationPrompt(userPrompt, variantCount);

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const { prompts } = await generateToolCallArgs<{ prompts: string[] }>(
        [
          { role: "system", content: VARIANT_SYSTEM_PROMPT },
          { role: "user", content: prompt },
        ],
        TOOL_RETURN_PROMPT_VARIANTS,
        { temperature: 0.8 }
      );

      if (!Array.isArray(prompts) || prompts.length < variantCount) {
        throw new Error("Expected prompt variants");
      }

      return prompts.slice(0, variantCount).map((item) => String(item));
    } catch (error) {
      console.log(`Variant generation attempt ${attempt + 1} failed:`, error);
      if (attempt === 2) {
        // Fallback: create simple variants manually
        const fallback = [
          userPrompt,
          `${userPrompt} - stylized and artistic`,
          `${userPrompt} - minimal and simple`,
          `${userPrompt} - creative interpretation`,
          `${userPrompt} - geometric`,
          `${userPrompt} - abstract`,
          `${userPrompt} - outlined`,
          `${userPrompt} - bold solid`,
        ];
        return fallback.slice(0, variantCount);
      }
    }
  }

  throw new Error("Failed to generate prompt variants");
}

/**
 * Generate a single SVG from a refined prompt with retry logic
 */
async function generateSingleSvg(
  refinedPrompt: string,
  selectedSvg?: string,
  feedback?: string
): Promise<string> {
  const basePrompt = selectedSvg && feedback
    ? getIterationSingleSvgPrompt(selectedSvg, feedback, refinedPrompt)
    : getSingleSvgPrompt(refinedPrompt);

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= 3; attempt++) {
    const finalPrompt =
      attempt > 0 ? `${basePrompt}\n\n${STRICTER_PROMPTS[attempt - 1]}` : basePrompt;

    try {
      const { svg } = await generateToolCallArgs<{ svg: string }>(
        [{ role: "user", content: finalPrompt }],
        TOOL_RETURN_SVG,
        { temperature: 0.7 - attempt * 0.1 } // Reduce temperature on retries
      );

      const sanitized = sanitizeSvg(svg);
      if (sanitized) {
        return sanitized;
      }
      throw new Error("Invalid SVG structure");
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.log(`SVG generation attempt ${attempt + 1} failed:`, lastError.message);
    }
  }

  throw lastError || new Error("Failed to generate SVG");
}

/**
 * Generate SVGs in parallel using diversified prompts
 * 1. First generates prompt variants from the user prompt
 * 2. Then generates SVGs for each variant in parallel
 */
export async function generateParallel(
  prompt: string,
  selectedSvg?: string,
  variantCount: number = 4,
  progress?: ProgressCallback
): Promise<string[]> {
  // Step 1: Generate 4 diverse prompt variants
  const variantPrompts = await generatePromptVariants(prompt, variantCount);

  // Step 2: Generate SVGs in parallel for each variant
  const svgPromises = variantPrompts.map(async (refinedPrompt, index) => {
    try {
      const svg = await generateSingleSvg(
        refinedPrompt,
        selectedSvg,
        selectedSvg ? prompt : undefined // Use original prompt as feedback during iteration
      );
      progress?.onVariantComplete(index, svg);
      return svg;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      progress?.onVariantError(index, message, false);
      // Return a placeholder SVG on failure
      return `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><text x="12" y="12" text-anchor="middle" font-size="6" fill="#999">Error</text></svg>`;
    }
  });

  const results = await Promise.all(svgPromises);
  return results;
}
