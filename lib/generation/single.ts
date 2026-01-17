import { generateToolCallArgs, TOOL_RETURN_SVG_VARIANTS } from "@/lib/cerebras/client";
import { getSingleModePrompt, getIterationPrompt, STRICTER_PROMPTS } from "@/lib/cerebras/prompts";
import { sanitizeSvg } from "@/lib/svg/sanitizer";

export async function generateSingle(
  prompt: string,
  selectedSvg?: string,
  variantCount: number = 4,
  onProgress?: (index: number, svg: string) => void
): Promise<string[]> {
  const systemPrompt = selectedSvg
    ? getIterationPrompt(selectedSvg, prompt, variantCount)
    : getSingleModePrompt(prompt, variantCount);

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= 3; attempt++) {
    const finalPrompt =
      attempt > 0
        ? `${systemPrompt}\n\n${STRICTER_PROMPTS[attempt - 1]}`
        : systemPrompt;

    try {
      const { svgs: rawSvgs } = await generateToolCallArgs<{ svgs: string[] }>(
        [{ role: "user", content: finalPrompt }],
        TOOL_RETURN_SVG_VARIANTS
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
        onProgress?.(index, svg);
      });

      // Ensure we have exactly the requested number of variants
      while (limitedSvgs.length < variantCount) {
        limitedSvgs.push(limitedSvgs[limitedSvgs.length - 1] || '<svg viewBox="0 0 24 24"></svg>');
      }

      return limitedSvgs;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.log(`Attempt ${attempt + 1} failed:`, lastError.message);
    }
  }

  throw lastError || new Error("Failed to generate SVGs after retries");
}
