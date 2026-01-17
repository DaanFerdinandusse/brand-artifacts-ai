import {
  IconSpec,
  PathElement,
  CircleElement,
  RectElement,
  LineElement,
} from "./schema";
import { getPreset } from "./presets";

function escapeAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function formatAttr(name: string, value: string | number | undefined): string {
  if (value === undefined || value === "none") return "";
  return ` ${name}="${escapeAttr(String(value))}"`;
}

function serializePath(
  path: PathElement,
  defaults: { stroke: string; strokeWidth: number; fill: string }
): string {
  const fill = path.fill ?? defaults.fill;
  const stroke = path.stroke ?? defaults.stroke;
  const strokeWidth = path.strokeWidth ?? defaults.strokeWidth;

  let attrs = `d="${escapeAttr(path.d)}"`;
  attrs += formatAttr("fill", fill);
  attrs += formatAttr("stroke", stroke);
  if (strokeWidth > 0) {
    attrs += formatAttr("stroke-width", strokeWidth);
  }
  if (path.opacity !== undefined) {
    attrs += formatAttr("opacity", path.opacity);
  }

  return `  <path ${attrs.trim()} />`;
}

function serializeCircle(
  circle: CircleElement,
  defaults: { stroke: string; strokeWidth: number; fill: string }
): string {
  const fill = circle.fill ?? defaults.fill;
  const stroke = circle.stroke ?? defaults.stroke;
  const strokeWidth = circle.strokeWidth ?? defaults.strokeWidth;

  let attrs = `cx="${circle.cx}" cy="${circle.cy}" r="${circle.r}"`;
  attrs += formatAttr("fill", fill);
  attrs += formatAttr("stroke", stroke);
  if (strokeWidth > 0) {
    attrs += formatAttr("stroke-width", strokeWidth);
  }
  if (circle.opacity !== undefined) {
    attrs += formatAttr("opacity", circle.opacity);
  }

  return `  <circle ${attrs.trim()} />`;
}

function serializeRect(
  rect: RectElement,
  defaults: { stroke: string; strokeWidth: number; fill: string }
): string {
  const fill = rect.fill ?? defaults.fill;
  const stroke = rect.stroke ?? defaults.stroke;
  const strokeWidth = rect.strokeWidth ?? defaults.strokeWidth;

  let attrs = `x="${rect.x}" y="${rect.y}" width="${rect.width}" height="${rect.height}"`;
  if (rect.rx !== undefined) attrs += formatAttr("rx", rect.rx);
  if (rect.ry !== undefined) attrs += formatAttr("ry", rect.ry);
  attrs += formatAttr("fill", fill);
  attrs += formatAttr("stroke", stroke);
  if (strokeWidth > 0) {
    attrs += formatAttr("stroke-width", strokeWidth);
  }
  if (rect.opacity !== undefined) {
    attrs += formatAttr("opacity", rect.opacity);
  }

  return `  <rect ${attrs.trim()} />`;
}

function serializeLine(
  line: LineElement,
  defaults: { stroke: string; strokeWidth: number }
): string {
  const stroke = line.stroke ?? defaults.stroke;
  const strokeWidth = line.strokeWidth ?? defaults.strokeWidth;

  let attrs = `x1="${line.x1}" y1="${line.y1}" x2="${line.x2}" y2="${line.y2}"`;
  attrs += formatAttr("stroke", stroke);
  if (strokeWidth > 0) {
    attrs += formatAttr("stroke-width", strokeWidth);
  }
  if (line.opacity !== undefined) {
    attrs += formatAttr("opacity", line.opacity);
  }

  return `  <line ${attrs.trim()} />`;
}

export function serializeSvg(spec: IconSpec, size?: number): string {
  const preset = getPreset(spec.preset);
  const displaySize = size ?? spec.size;

  const defaults = {
    stroke: spec.stroke,
    strokeWidth: spec.strokeWidth,
    fill: spec.fill,
  };

  const elements: string[] = [];

  // Serialize all elements
  spec.paths.forEach((path) => {
    elements.push(serializePath(path, defaults));
  });

  spec.circles?.forEach((circle) => {
    elements.push(serializeCircle(circle, defaults));
  });

  spec.rects?.forEach((rect) => {
    elements.push(serializeRect(rect, defaults));
  });

  spec.lines?.forEach((line) => {
    elements.push(serializeLine(line, { stroke: defaults.stroke, strokeWidth: defaults.strokeWidth }));
  });

  const svgContent = elements.join("\n");

  return `<svg width="${displaySize}" height="${displaySize}" viewBox="${spec.viewBox}" fill="none" xmlns="http://www.w3.org/2000/svg" stroke-linecap="${preset.strokeLinecap}" stroke-linejoin="${preset.strokeLinejoin}">
${svgContent}
</svg>`;
}

export function serializeSvgForExport(spec: IconSpec, color: string = "currentColor"): string {
  // For export, replace currentColor with actual color
  const exportSpec = { ...spec };
  if (exportSpec.stroke === "currentColor") {
    exportSpec.stroke = color;
  }
  if (exportSpec.fill === "currentColor") {
    exportSpec.fill = color;
  }
  return serializeSvg(exportSpec);
}
