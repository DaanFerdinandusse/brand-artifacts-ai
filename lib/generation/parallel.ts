import { generateCompletion } from "@/lib/cerebras/client";
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
 * Parse JSON array from model response
 * Handles cases where model may include markdown or extra text
 */
function parseVariantPrompts(response: string): string[] {
  // Try to extract JSON array from response
  const arrayMatch = response.match(/\[[\s\S]*?\]/);
  if (!arrayMatch) {
    throw new Error("No JSON array found in response");
  }

  try {
    const parsed = JSON.parse(arrayMatch[0]);
    if (!Array.isArray(parsed) || parsed.length < 4) {
      throw new Error("Expected array of 4 prompts");
    }
    return parsed.slice(0, 4).map((p) => String(p));
  } catch {
    throw new Error("Failed to parse prompt variants JSON");
  }
}

/**
 * Generate 4 diverse prompt variants from a user prompt
 */
async function generatePromptVariants(userPrompt: string): Promise<string[]> {
  const prompt = getVariantGenerationPrompt(userPrompt);

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await generateCompletion(
        [
          { role: "system", content: VARIANT_SYSTEM_PROMPT },
          { role: "user", content: prompt },
        ],
        { temperature: 0.8 }
      );

      return parseVariantPrompts(response);
    } catch (error) {
      console.log(`Variant generation attempt ${attempt + 1} failed:`, error);
      if (attempt === 2) {
        // Fallback: create simple variants manually
        return [
          userPrompt,
          `${userPrompt} - stylized and artistic`,
          `${userPrompt} - minimal and simple`,
          `${userPrompt} - creative interpretation`,
        ];
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
      const response = await generateCompletion([{ role: "user", content: finalPrompt }], {
        temperature: 0.7 - attempt * 0.1, // Reduce temperature on retries
      });

      const sanitized = sanitizeSvg(response);
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
 * Generate 4 SVGs in parallel using diversified prompts
 * 1. First generates 4 prompt variants from the user prompt
 * 2. Then generates SVGs for each variant in parallel
 */
export async function generateParallel(
  prompt: string,
  selectedSvg?: string,
  progress?: ProgressCallback
): Promise<string[]> {
  // Step 1: Generate 4 diverse prompt variants
  const variantPrompts = await generatePromptVariants(prompt);

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
