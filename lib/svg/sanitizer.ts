const DANGEROUS_ELEMENTS = [
  "script",
  "iframe",
  "object",
  "embed",
  "foreignObject",
  "image",
];

const DANGEROUS_ATTRIBUTES = [
  "onclick",
  "onload",
  "onerror",
  "onmouseover",
  "onmouseout",
  "onmousedown",
  "onmouseup",
  "onfocus",
  "onblur",
];

const DANGEROUS_PATTERNS = [/javascript:/i, /data:/i, /vbscript:/i];

export function sanitizeSvg(svgString: string): string | null {
  // Extract SVG from potential markdown or surrounding text
  const svgMatch = svgString.match(/<svg[\s\S]*?<\/svg>/i);
  if (!svgMatch) {
    return null;
  }

  let svg = svgMatch[0];

  // Remove dangerous elements using regex (server-side compatible)
  for (const element of DANGEROUS_ELEMENTS) {
    const regex = new RegExp(`<${element}[^>]*>[\\s\\S]*?<\\/${element}>`, "gi");
    svg = svg.replace(regex, "");
    // Also remove self-closing variants
    const selfClosingRegex = new RegExp(`<${element}[^>]*\\/?>`, "gi");
    svg = svg.replace(selfClosingRegex, "");
  }

  // Remove dangerous attributes
  for (const attr of DANGEROUS_ATTRIBUTES) {
    const regex = new RegExp(`\\s${attr}\\s*=\\s*["'][^"']*["']`, "gi");
    svg = svg.replace(regex, "");
  }

  // Remove dangerous patterns in attribute values
  for (const pattern of DANGEROUS_PATTERNS) {
    // Match attributes containing dangerous patterns
    svg = svg.replace(
      /(\s(?:href|xlink:href)\s*=\s*["'])([^"']*)(["'])/gi,
      (match, prefix, value, suffix) => {
        if (pattern.test(value)) {
          return "";
        }
        return match;
      }
    );
  }

  // Remove external URL references in href/xlink:href
  svg = svg.replace(
    /(\s(?:href|xlink:href)\s*=\s*["'])(https?:\/\/[^"']*)(["'])/gi,
    ""
  );

  // Validate basic SVG structure
  if (!svg.startsWith("<svg") || !svg.endsWith("</svg>")) {
    return null;
  }

  return svg;
}

export function extractSvgsFromJson(jsonString: string): string[] {
  try {
    // Try to extract JSON from potential markdown code blocks
    let cleanJson = jsonString;

    // Remove markdown code block if present
    const jsonMatch = jsonString.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      cleanJson = jsonMatch[1].trim();
    }

    // Find JSON object in the response
    const jsonObjectMatch = cleanJson.match(/\{[\s\S]*\}/);
    if (!jsonObjectMatch) {
      return [];
    }

    const parsed = JSON.parse(jsonObjectMatch[0]);

    if (parsed.svgs && Array.isArray(parsed.svgs)) {
      return parsed.svgs.map((svg: string) => sanitizeSvg(svg)).filter(Boolean) as string[];
    }

    return [];
  } catch {
    // If JSON parsing fails, try to extract SVGs directly
    const svgMatches = jsonString.match(/<svg[\s\S]*?<\/svg>/gi);
    if (svgMatches) {
      return svgMatches
        .map((svg) => sanitizeSvg(svg))
        .filter(Boolean) as string[];
    }
    return [];
  }
}
