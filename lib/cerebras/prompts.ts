export const SVG_SYSTEM_PROMPT = `You are an expert SVG icon designer. Generate clean, scalable SVG icons.

OUTPUT REQUIREMENTS:
- Do NOT respond with text
- Always use the required tool call to return outputs
- Use viewBox="0 0 24 24" for standard icon sizing
- SVG must be self-contained (no external references)
- Optimize for clarity at small sizes

ALLOWED ELEMENTS:
- Basic shapes: path, circle, rect, line, polyline, polygon, ellipse
- Grouping: g, defs, use
- Styling: fill, stroke, stroke-width, stroke-linecap, stroke-linejoin
- Gradients: linearGradient, radialGradient, stop
- Transforms: transform attribute

FORBIDDEN:
- <script> tags
- Event handlers (onclick, onload, etc.)
- External references (xlink:href to URLs)
- <image> or <foreignObject> elements
- Embedded data: URIs

The user will describe what icon they want. Create exactly what they describe.`;

export function getSingleModePrompt(userPrompt: string): string {
  return `${SVG_SYSTEM_PROMPT}

Generate 4 DISTINCT SVG icon variations for this request. Each should be a different valid interpretation.

User request: "${userPrompt}"

Call the tool "return_svg_variants" with an array of 4 SVG strings.`;
}

export function getIterationPrompt(selectedSvg: string, feedback: string): string {
  return `${SVG_SYSTEM_PROMPT}

The user selected this SVG variant and wants changes:

SELECTED SVG:
${selectedSvg}

USER FEEDBACK:
${feedback}

Generate 4 new variations that incorporate the feedback while maintaining the essence of the selected design.

Call the tool "return_svg_variants" with an array of 4 SVG strings.`;
}

export const STRICTER_PROMPTS = [
  `Remember: Do NOT respond with text. Always call the required tool.`,
  `Only call the tool with valid SVG strings. No other output.`,
  `Create a simple, minimal SVG icon. Use only basic shapes (path, circle, rect). Call the required tool only.`,
];

export const VARIANT_SYSTEM_PROMPT = `You are an expert at creating diverse prompt variations for SVG icon generation. Given a user's icon request, create 4 distinct prompt variations that will lead to different but valid interpretations of the icon.`;

export function getVariantGenerationPrompt(userPrompt: string): string {
  return `Given this user request for an SVG icon: "${userPrompt}"

Generate 4 DISTINCT prompt variations that will produce different but valid interpretations:
1. A literal interpretation - exactly what the user described
2. A more stylized/artistic interpretation - with creative flair
3. A minimal/simplified interpretation - clean and simple
4. A creative/unique interpretation - an unexpected but valid take

Call the tool "return_prompt_variants" with an array of 4 strings.`;
}

export function getSingleSvgPrompt(refinedPrompt: string): string {
  return `${SVG_SYSTEM_PROMPT}

Create an SVG icon for: "${refinedPrompt}"

Call the tool "return_svg" with the SVG string.`;
}

export function getIterationSingleSvgPrompt(selectedSvg: string, feedback: string, refinedPrompt: string): string {
  return `${SVG_SYSTEM_PROMPT}

The user selected this SVG variant and wants changes:

SELECTED SVG:
${selectedSvg}

USER FEEDBACK:
${feedback}

Your interpretation style: ${refinedPrompt}

Generate a new SVG that incorporates the feedback while maintaining the essence of the selected design and matching the interpretation style.

Call the tool "return_svg" with the SVG string.`;
}

// Regeneration prompts - for when user rejects all variants

export function getCritiquePrompt(originalPrompt: string, rejectedSvgs: string[]): string {
  return `The user rejected these 4 SVG icons for their request "${originalPrompt}":

${rejectedSvgs.map((svg, i) => `Variant ${i + 1}:\n${svg}`).join('\n\n')}

Briefly summarize what was likely wrong with these (be concise, 1-2 sentences). Focus on what common issues might have made them all unacceptable.

Call the tool "return_critique" with the critique string.`;
}

export function getRegenerateWithCritiquePrompt(originalPrompt: string, critique: string): string {
  return `${SVG_SYSTEM_PROMPT}

Previous attempt critique: ${critique}

Create 4 NEW SVG variations for: "${originalPrompt}"
Avoid the issues identified in the critique. Make these significantly different from the previous batch.

Call the tool "return_svg_variants" with an array of 4 SVG strings.`;
}
