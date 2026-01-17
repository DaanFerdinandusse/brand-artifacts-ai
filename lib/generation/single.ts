import { generateCompletion } from "@/lib/cerebras/client";
import { getSingleModePrompt, getIterationPrompt, STRICTER_PROMPTS } from "@/lib/cerebras/prompts";
import { extractSvgsFromJson } from "@/lib/svg/sanitizer";

export async function generateSingle(
  prompt: string,
  selectedSvg?: string,
  onProgress?: (index: number, svg: string) => void
): Promise<string[]> {
  const systemPrompt = selectedSvg
    ? getIterationPrompt(selectedSvg, prompt)
    : getSingleModePrompt(prompt);

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= 3; attempt++) {
    const finalPrompt =
      attempt > 0
        ? `${systemPrompt}\n\n${STRICTER_PROMPTS[attempt - 1]}`
        : systemPrompt;

    try {
      const response = await generateCompletion([
        { role: "user", content: finalPrompt },
      ]);

      const svgs = extractSvgsFromJson(response);

      if (svgs.length === 0) {
        throw new Error("No valid SVGs extracted from response");
      }

      // Notify progress for each SVG
      svgs.forEach((svg, index) => {
        onProgress?.(index, svg);
      });

      // Ensure we have exactly 4 variants
      while (svgs.length < 4) {
        svgs.push(svgs[svgs.length - 1] || '<svg viewBox="0 0 24 24"></svg>');
      }

      return svgs.slice(0, 4);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.log(`Attempt ${attempt + 1} failed:`, lastError.message);
    }
  }

  throw lastError || new Error("Failed to generate SVGs after retries");
}
