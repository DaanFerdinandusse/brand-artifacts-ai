import {
  IconDraft,
  IconDraftSchema,
  IconGeometry,
  IconPresetApplyOptions,
  IconPresetApplyResult,
} from "../schema";
import { getPaddingForSize, getPreset, getStrokeWidthForSize } from "../presets";

const NUMBER_REGEX = /[-+]?(?:\d*\.\d+|\d+)(?:[eE][-+]?\d+)?/g;

const DEFAULT_EXPORTS = { svg: true, png: [64, 128, 256] };

function formatNumber(value: number): string {
  const clean = Object.is(value, -0) ? 0 : value;
  const text = String(clean);
  if (text.includes("e") || text.includes("E")) {
    return text;
  }
  return text.replace(/(?:\.0+|(\.\d+?)0+)$/, "$1");
}

function snapNumber(value: number, gridSize: number): number {
  const snapped = Math.round(value / gridSize) * gridSize;
  return Object.is(snapped, -0) ? 0 : snapped;
}

function normalizePathData(
  d: string,
  snapToGrid: boolean,
  gridSize: number
): string {
  const replaced = d.replace(NUMBER_REGEX, (match) => {
    const value = Number(match);
    if (!Number.isFinite(value)) {
      return match;
    }
    const adjusted = snapToGrid ? snapNumber(value, gridSize) : value;
    return formatNumber(adjusted);
  });
  return replaced.replace(/\s+/g, " ").trim();
}

function normalizeViewBox(viewBox: string, size: number): string {
  const numbers = viewBox.match(NUMBER_REGEX)?.map((value) => Number(value)) ?? [];
  if (numbers.length !== 4 || numbers.some((value) => !Number.isFinite(value))) {
    return `0 0 ${size} ${size}`;
  }
  const [minX, minY, width, height] = numbers;
  if (minX !== 0 || minY !== 0 || width !== size || height !== size) {
    return `0 0 ${size} ${size}`;
  }
  return `${minX} ${minY} ${width} ${height}`;
}

function buildGeometry(draft: IconDraft): IconGeometry {
  return {
    paths: draft.paths ?? [],
    circles: draft.circles ?? [],
    rects: draft.rects ?? [],
    lines: draft.lines ?? [],
    polylines: draft.polylines ?? [],
  };
}

export function iconPresetApply(
  draftInput: IconDraft,
  options?: IconPresetApplyOptions
): IconPresetApplyResult {
  const parsedDraft = IconDraftSchema.parse(draftInput);
  const resolvedOptions = {
    normalize: true,
    snapToGrid: true,
    fillMissingDefaults: true,
    ...(options ?? {}),
  };

  const changes: IconPresetApplyResult["changes"] = [];

  const preset = getPreset(parsedDraft.preset);
  const size = parsedDraft.size;

  const strokeWidth = getStrokeWidthForSize(preset, size);
  const padding = getPaddingForSize(preset, size);

  const viewBox = resolvedOptions.normalize
    ? normalizeViewBox(parsedDraft.viewBox, size)
    : parsedDraft.viewBox;

  if (viewBox !== parsedDraft.viewBox) {
    changes.push({
      type: "normalizeViewBox",
      path: "$.viewBox",
      before: parsedDraft.viewBox,
      after: viewBox,
    });
  }

  const exports =
    resolvedOptions.fillMissingDefaults && !parsedDraft.exports
      ? DEFAULT_EXPORTS
      : parsedDraft.exports ?? DEFAULT_EXPORTS;

  if (exports !== parsedDraft.exports) {
    changes.push({
      type: "fillMissingDefaults",
      path: "$.exports",
      before: parsedDraft.exports,
      after: exports,
    });
  }

  const geometry = buildGeometry(parsedDraft);

  const gridSize = preset.constraints.gridSize ?? 1;
  const snapToGrid = resolvedOptions.snapToGrid;

  const paths = geometry.paths.map((path, index) => {
    const shouldNormalize = resolvedOptions.normalize || snapToGrid;
    const normalized = shouldNormalize
      ? normalizePathData(path.d, snapToGrid, gridSize)
      : path.d;
    if (normalized !== path.d) {
      changes.push({
        type: snapToGrid ? "snapToGrid" : "normalizePath",
        path: `$.paths[${index}].d`,
        before: path.d,
        after: normalized,
      });
    }
    return { d: normalized };
  });

  const circles = geometry.circles.map((circle, index) => {
    if (!snapToGrid) {
      return circle;
    }
    const snapped = {
      cx: snapNumber(circle.cx, gridSize),
      cy: snapNumber(circle.cy, gridSize),
      r: snapNumber(circle.r, gridSize),
    };
    if (
      snapped.cx !== circle.cx ||
      snapped.cy !== circle.cy ||
      snapped.r !== circle.r
    ) {
      changes.push({
        type: "snapToGrid",
        path: `$.circles[${index}]`,
        before: circle,
        after: snapped,
      });
    }
    return snapped;
  });

  const rects = geometry.rects.map((rect, index) => {
    if (!snapToGrid) {
      return rect;
    }
    const snapped = {
      x: snapNumber(rect.x, gridSize),
      y: snapNumber(rect.y, gridSize),
      width: snapNumber(rect.width, gridSize),
      height: snapNumber(rect.height, gridSize),
      rx: rect.rx !== undefined ? snapNumber(rect.rx, gridSize) : undefined,
      ry: rect.ry !== undefined ? snapNumber(rect.ry, gridSize) : undefined,
    };
    if (
      snapped.x !== rect.x ||
      snapped.y !== rect.y ||
      snapped.width !== rect.width ||
      snapped.height !== rect.height ||
      snapped.rx !== rect.rx ||
      snapped.ry !== rect.ry
    ) {
      changes.push({
        type: "snapToGrid",
        path: `$.rects[${index}]`,
        before: rect,
        after: snapped,
      });
    }
    return snapped;
  });

  const lines = geometry.lines.map((line, index) => {
    if (!snapToGrid) {
      return line;
    }
    const snapped = {
      x1: snapNumber(line.x1, gridSize),
      y1: snapNumber(line.y1, gridSize),
      x2: snapNumber(line.x2, gridSize),
      y2: snapNumber(line.y2, gridSize),
    };
    if (
      snapped.x1 !== line.x1 ||
      snapped.y1 !== line.y1 ||
      snapped.x2 !== line.x2 ||
      snapped.y2 !== line.y2
    ) {
      changes.push({
        type: "snapToGrid",
        path: `$.lines[${index}]`,
        before: line,
        after: snapped,
      });
    }
    return snapped;
  });

  const polylines = geometry.polylines.map((polyline, index) => {
    const shouldNormalize = resolvedOptions.normalize || snapToGrid;
    if (!shouldNormalize) {
      return polyline;
    }
    const points = polyline.points.replace(NUMBER_REGEX, (match) => {
      const value = Number(match);
      if (!Number.isFinite(value)) {
        return match;
      }
      const adjusted = snapToGrid ? snapNumber(value, gridSize) : value;
      return formatNumber(adjusted);
    });
    if (points !== polyline.points) {
      changes.push({
        type: "snapToGrid",
        path: `$.polylines[${index}].points`,
        before: polyline.points,
        after: points,
      });
    }
    return { points };
  });

  return {
    docType: "iconPresetApplyResult",
    expanded: {
      docType: "iconExpanded",
      name: parsedDraft.name,
      preset: parsedDraft.preset,
      size,
      viewBox,
      style: {
        strokeWidth,
        stroke: preset.style.stroke,
        fill: preset.style.fill,
        strokeLinecap: preset.style.strokeLinecap,
        strokeLinejoin: preset.style.strokeLinejoin,
      },
      constraints: {
        gridSize,
        padding,
        maxTotalPathCommands: preset.constraints.maxTotalPathCommands,
        maxPaths: preset.constraints.maxPaths,
      },
      geometry: {
        paths,
        circles,
        rects,
        lines,
        polylines,
      },
      exports,
    },
    changes,
  };
}

export function iconPresetApplyTool(input: {
  draft: IconDraft;
  options?: IconPresetApplyOptions;
}): IconPresetApplyResult {
  return iconPresetApply(input.draft, input.options);
}
