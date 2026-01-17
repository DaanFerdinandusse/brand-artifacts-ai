import { IconSpecExpanded } from "./schema";
import { iconCompileSvg } from "./tools/compileSvg";

function replaceCurrentColor(svg: string, color: string): string {
  if (color === "currentColor") {
    return svg;
  }
  return svg.replace(/currentColor/g, color);
}

export function serializeSvg(spec: IconSpecExpanded): string {
  const compiled = iconCompileSvg(spec);
  if (!compiled.ok) {
    throw new Error("Icon compilation failed");
  }
  return compiled.svg;
}

export function serializeSvgForExport(
  spec: IconSpecExpanded,
  color: string = "currentColor"
): string {
  const svg = serializeSvg(spec);
  return replaceCurrentColor(svg, color);
}
