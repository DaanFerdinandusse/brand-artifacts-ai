import {
  IconCompileResult,
  IconSpecExpanded,
  IconSpecExpandedSchema,
} from "../schema";
import { iconValidate } from "./validate";

function escapeAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function formatAttr(name: string, value: string | number | undefined): string {
  if (value === undefined) return "";
  return ` ${name}="${escapeAttr(String(value))}"`;
}

function serializePath(d: string): string {
  return `<path d="${escapeAttr(d)}" />`;
}

function serializeRect(rect: {
  x: number;
  y: number;
  width: number;
  height: number;
  rx?: number;
  ry?: number;
}): string {
  let attrs = `x="${rect.x}" y="${rect.y}" width="${rect.width}" height="${rect.height}"`;
  attrs += formatAttr("rx", rect.rx);
  attrs += formatAttr("ry", rect.ry);
  return `<rect ${attrs} />`;
}

function serializeCircle(circle: { cx: number; cy: number; r: number }): string {
  return `<circle cx="${circle.cx}" cy="${circle.cy}" r="${circle.r}" />`;
}

function serializeLine(line: {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}): string {
  return `<line x1="${line.x1}" y1="${line.y1}" x2="${line.x2}" y2="${line.y2}" />`;
}

function serializePolyline(polyline: { points: string }): string {
  return `<polyline points="${escapeAttr(polyline.points)}" />`;
}

function buildSvg(expanded: IconSpecExpanded, minify: boolean): string {
  const { size, viewBox, style, geometry } = expanded;
  const elements: string[] = [];

  geometry.paths.forEach((path) => {
    elements.push(serializePath(path.d));
  });
  geometry.rects.forEach((rect) => {
    elements.push(serializeRect(rect));
  });
  geometry.circles.forEach((circle) => {
    elements.push(serializeCircle(circle));
  });
  geometry.lines.forEach((line) => {
    elements.push(serializeLine(line));
  });
  geometry.polylines.forEach((polyline) => {
    elements.push(serializePolyline(polyline));
  });

  const svgAttrs = [
    `width="${size}"`,
    `height="${size}"`,
    `viewBox="${escapeAttr(viewBox)}"`,
    `fill="${escapeAttr(style.fill)}"`,
    `xmlns="http://www.w3.org/2000/svg"`,
    `stroke="${escapeAttr(style.stroke)}"`,
    `stroke-width="${style.strokeWidth}"`,
    `stroke-linecap="${style.strokeLinecap}"`,
    `stroke-linejoin="${style.strokeLinejoin}"`,
  ];

  if (minify) {
    return `<svg ${svgAttrs.join(" ")}>${elements.join("")}</svg>`;
  }

  const formattedElements = elements.map((element) => `  ${element}`).join("\n");
  return `<svg ${svgAttrs.join(" ")}>\n${formattedElements}\n</svg>`;
}

export function iconCompileSvg(expanded: IconSpecExpanded): IconCompileResult {
  const validation = iconValidate(expanded);
  const errors = validation.issues.filter((issue) => issue.severity === "error");
  if (errors.length > 0) {
    return {
      docType: "iconCompileError",
      ok: false,
      issues: errors,
    };
  }

  const spec = IconSpecExpandedSchema.parse(expanded);

  const svg = buildSvg(spec, false);
  const svgMin = buildSvg(spec, true);

  return {
    docType: "iconCompileResult",
    ok: true,
    svg,
    svgMin,
    metadata: {
      size: spec.size,
      viewBox: spec.viewBox,
      pathCount: validation.metrics.pathCount,
      totalPathCommands: validation.metrics.totalPathCommands,
      strokeWidth: spec.style.strokeWidth,
      padding: spec.constraints.padding,
    },
  };
}

export function iconCompileSvgTool(input: { expanded: IconSpecExpanded }): IconCompileResult {
  return iconCompileSvg(input.expanded);
}
