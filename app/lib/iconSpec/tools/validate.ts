import {
  IconSpecExpanded,
  IconSpecExpandedSchema,
  IconValidationIssue,
  IconValidationMetrics,
  IconValidationResult,
} from "../schema";
import { iconPresetRegistry } from "../presets";

const NUMBER_REGEX = /[-+]?(?:\d*\.\d+|\d+)(?:[eE][-+]?\d+)?/g;

function formatJsonPath(pathSegments: Array<string | number>): string {
  if (pathSegments.length === 0) {
    return "$";
  }
  return pathSegments.reduce((acc, segment) => {
    if (typeof segment === "number") {
      return `${acc}[${segment}]`;
    }
    if (/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(segment)) {
      return `${acc}.${segment}`;
    }
    return `${acc}["${segment}"]`;
  }, "$");
}

function addIssue(
  issues: IconValidationIssue[],
  issue: IconValidationIssue
): void {
  issues.push(issue);
}

function parseViewBox(viewBox: string): number[] | null {
  const numbers = viewBox.match(NUMBER_REGEX)?.map((value) => Number(value)) ?? [];
  if (numbers.length !== 4 || numbers.some((value) => !Number.isFinite(value))) {
    return null;
  }
  return numbers;
}

function extractNumbers(value: string): number[] {
  return (value.match(NUMBER_REGEX) ?? []).map((match) => Number(match));
}

function estimatePathBounds(pathData: string): {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
} | null {
  const numbers = extractNumbers(pathData);
  if (numbers.length < 2) {
    return null;
  }
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < numbers.length - 1; i += 2) {
    const x = numbers[i];
    const y = numbers[i + 1];
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      continue;
    }
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  if (!Number.isFinite(minX)) {
    return null;
  }
  return { minX, minY, maxX, maxY };
}

function mergeBounds(
  a: { minX: number; minY: number; maxX: number; maxY: number } | null,
  b: { minX: number; minY: number; maxX: number; maxY: number } | null
): { minX: number; minY: number; maxX: number; maxY: number } | null {
  if (!a) return b;
  if (!b) return a;
  return {
    minX: Math.min(a.minX, b.minX),
    minY: Math.min(a.minY, b.minY),
    maxX: Math.max(a.maxX, b.maxX),
    maxY: Math.max(a.maxY, b.maxY),
  };
}

function countPathCommands(pathData: string): number {
  const matches = pathData.match(/[a-zA-Z]/g);
  return matches ? matches.length : 0;
}

function isMultiple(value: number, gridSize: number): boolean {
  const scaled = value / gridSize;
  return Math.abs(scaled - Math.round(scaled)) < 1e-6;
}

function checkForExtraKeys(
  obj: Record<string, unknown>,
  allowedKeys: string[]
): string[] {
  return Object.keys(obj).filter((key) => !allowedKeys.includes(key));
}

export function iconValidate(expanded: IconSpecExpanded): IconValidationResult {
  const issues: IconValidationIssue[] = [];
  const metrics: IconValidationMetrics = {
    pathCount: 0,
    totalPathCommands: 0,
    estimatedStrokeBounds: undefined,
  };

  const schemaResult = IconSpecExpandedSchema.safeParse(expanded);
  if (!schemaResult.success) {
    for (const issue of schemaResult.error.issues) {
      addIssue(issues, {
        code: "ICON_SCHEMA_001",
        message: issue.message,
        severity: "error",
        jsonPath: formatJsonPath(issue.path as Array<string | number>),
        details: issue,
      });
    }
    return {
      docType: "iconValidation",
      valid: false,
      issues,
      metrics,
    };
  }

  const spec = schemaResult.data;

  const preset = iconPresetRegistry[spec.preset];

  if (!preset) {
    addIssue(issues, {
      code: "ICON_PRESET_001",
      message: `Unknown preset "${spec.preset}"`,
      severity: "error",
      jsonPath: "$.preset",
    });
  }

  if (preset && spec.style.stroke !== preset.style.stroke) {
    addIssue(issues, {
      code: "ICON_STYLE_001",
      message: "Stroke value must match preset",
      severity: "error",
      jsonPath: "$.style.stroke",
      details: { expected: preset.style.stroke, received: spec.style.stroke },
    });
  }
  if (preset && spec.style.fill !== preset.style.fill) {
    addIssue(issues, {
      code: "ICON_STYLE_002",
      message: "Fill value must match preset",
      severity: "error",
      jsonPath: "$.style.fill",
      details: { expected: preset.style.fill, received: spec.style.fill },
    });
  }
  if (preset && spec.style.strokeLinecap !== preset.style.strokeLinecap) {
    addIssue(issues, {
      code: "ICON_STYLE_003",
      message: "strokeLinecap must match preset",
      severity: "error",
      jsonPath: "$.style.strokeLinecap",
      details: {
        expected: preset.style.strokeLinecap,
        received: spec.style.strokeLinecap,
      },
    });
  }
  if (preset && spec.style.strokeLinejoin !== preset.style.strokeLinejoin) {
    addIssue(issues, {
      code: "ICON_STYLE_004",
      message: "strokeLinejoin must match preset",
      severity: "error",
      jsonPath: "$.style.strokeLinejoin",
      details: {
        expected: preset.style.strokeLinejoin,
        received: spec.style.strokeLinejoin,
      },
    });
  }

  const expectedStrokeWidth = preset
    ? preset.strokeWidthBySize[spec.size] ?? preset.strokeWidthBySize[24]
    : undefined;
  if (
    expectedStrokeWidth !== undefined &&
    spec.style.strokeWidth !== expectedStrokeWidth
  ) {
    addIssue(issues, {
      code: "ICON_STYLE_005",
      message: "strokeWidth must match preset size mapping",
      severity: "error",
      jsonPath: "$.style.strokeWidth",
      details: { expected: expectedStrokeWidth, received: spec.style.strokeWidth },
    });
  }

  const viewBoxNumbers = parseViewBox(spec.viewBox);
  if (!viewBoxNumbers) {
    addIssue(issues, {
      code: "ICON_VIEWBOX_001",
      message: "viewBox must contain four numbers",
      severity: "error",
      jsonPath: "$.viewBox",
    });
  } else {
    const [minX, minY, width, height] = viewBoxNumbers;
    if (minX !== 0 || minY !== 0 || width !== spec.size || height !== spec.size) {
      addIssue(issues, {
        code: "ICON_VIEWBOX_002",
        message: "viewBox must match size",
        severity: "error",
        jsonPath: "$.viewBox",
        details: { expected: `0 0 ${spec.size} ${spec.size}`, received: spec.viewBox },
      });
    }
  }

  const rawExpanded = expanded as Record<string, unknown>;
  const rawGeometry = (rawExpanded.geometry as Record<string, unknown>) || {};
  const rawPaths = Array.isArray(rawGeometry.paths)
    ? (rawGeometry.paths as Array<Record<string, unknown>>)
    : [];
  const rawCircles = Array.isArray(rawGeometry.circles)
    ? (rawGeometry.circles as Array<Record<string, unknown>>)
    : [];
  const rawRects = Array.isArray(rawGeometry.rects)
    ? (rawGeometry.rects as Array<Record<string, unknown>>)
    : [];
  const rawLines = Array.isArray(rawGeometry.lines)
    ? (rawGeometry.lines as Array<Record<string, unknown>>)
    : [];
  const rawPolylines = Array.isArray(rawGeometry.polylines)
    ? (rawGeometry.polylines as Array<Record<string, unknown>>)
    : [];

  rawPaths.forEach((path, index) => {
    const extras = checkForExtraKeys(path, ["d"]);
    if (extras.length > 0) {
      addIssue(issues, {
        code: "ICON_STYLE_006",
        message: "Per-shape styling is not allowed",
        severity: "error",
        jsonPath: `$.geometry.paths[${index}]`,
        details: { keys: extras },
      });
    }
  });
  rawCircles.forEach((circle, index) => {
    const extras = checkForExtraKeys(circle, ["cx", "cy", "r"]);
    if (extras.length > 0) {
      addIssue(issues, {
        code: "ICON_STYLE_006",
        message: "Per-shape styling is not allowed",
        severity: "error",
        jsonPath: `$.geometry.circles[${index}]`,
        details: { keys: extras },
      });
    }
  });
  rawRects.forEach((rect, index) => {
    const extras = checkForExtraKeys(rect, ["x", "y", "width", "height", "rx", "ry"]);
    if (extras.length > 0) {
      addIssue(issues, {
        code: "ICON_STYLE_006",
        message: "Per-shape styling is not allowed",
        severity: "error",
        jsonPath: `$.geometry.rects[${index}]`,
        details: { keys: extras },
      });
    }
  });
  rawLines.forEach((line, index) => {
    const extras = checkForExtraKeys(line, ["x1", "y1", "x2", "y2"]);
    if (extras.length > 0) {
      addIssue(issues, {
        code: "ICON_STYLE_006",
        message: "Per-shape styling is not allowed",
        severity: "error",
        jsonPath: `$.geometry.lines[${index}]`,
        details: { keys: extras },
      });
    }
  });
  rawPolylines.forEach((polyline, index) => {
    const extras = checkForExtraKeys(polyline, ["points"]);
    if (extras.length > 0) {
      addIssue(issues, {
        code: "ICON_STYLE_006",
        message: "Per-shape styling is not allowed",
        severity: "error",
        jsonPath: `$.geometry.polylines[${index}]`,
        details: { keys: extras },
      });
    }
  });

  const gridSize = spec.constraints.gridSize ?? 1;

  spec.geometry.paths.forEach((path, index) => {
    const numbers = extractNumbers(path.d);
    const invalid = numbers.some((value) => !isMultiple(value, gridSize));
    if (invalid) {
      addIssue(issues, {
        code: "ICON_GRID_002",
        message: "Path data must align to grid",
        severity: "error",
        jsonPath: `$.geometry.paths[${index}].d`,
      });
    }
  });

  const numericChecks: Array<{
    value: number;
    path: string;
  }> = [];

  spec.geometry.circles.forEach((circle, index) => {
    numericChecks.push(
      { value: circle.cx, path: `$.geometry.circles[${index}].cx` },
      { value: circle.cy, path: `$.geometry.circles[${index}].cy` },
      { value: circle.r, path: `$.geometry.circles[${index}].r` }
    );
  });
  spec.geometry.rects.forEach((rect, index) => {
    numericChecks.push(
      { value: rect.x, path: `$.geometry.rects[${index}].x` },
      { value: rect.y, path: `$.geometry.rects[${index}].y` },
      { value: rect.width, path: `$.geometry.rects[${index}].width` },
      { value: rect.height, path: `$.geometry.rects[${index}].height` }
    );
    if (rect.rx !== undefined) {
      numericChecks.push({
        value: rect.rx,
        path: `$.geometry.rects[${index}].rx`,
      });
    }
    if (rect.ry !== undefined) {
      numericChecks.push({
        value: rect.ry,
        path: `$.geometry.rects[${index}].ry`,
      });
    }
  });
  spec.geometry.lines.forEach((line, index) => {
    numericChecks.push(
      { value: line.x1, path: `$.geometry.lines[${index}].x1` },
      { value: line.y1, path: `$.geometry.lines[${index}].y1` },
      { value: line.x2, path: `$.geometry.lines[${index}].x2` },
      { value: line.y2, path: `$.geometry.lines[${index}].y2` }
    );
  });
  spec.geometry.polylines.forEach((polyline, index) => {
    const numbers = extractNumbers(polyline.points);
    const invalid = numbers.some((value) => !isMultiple(value, gridSize));
    if (invalid) {
      addIssue(issues, {
        code: "ICON_GRID_002",
        message: "Polyline points must align to grid",
        severity: "error",
        jsonPath: `$.geometry.polylines[${index}].points`,
      });
    }
  });

  numericChecks.forEach(({ value, path }) => {
    if (!isMultiple(value, gridSize)) {
      addIssue(issues, {
        code: "ICON_GRID_001",
        message: "Numeric values must align to grid",
        severity: "error",
        jsonPath: path,
      });
    }
  });

  let bounds: { minX: number; minY: number; maxX: number; maxY: number } | null =
    null;

  spec.geometry.paths.forEach((path) => {
    bounds = mergeBounds(bounds, estimatePathBounds(path.d));
  });
  spec.geometry.circles.forEach((circle) => {
    bounds = mergeBounds(bounds, {
      minX: circle.cx - circle.r,
      minY: circle.cy - circle.r,
      maxX: circle.cx + circle.r,
      maxY: circle.cy + circle.r,
    });
  });
  spec.geometry.rects.forEach((rect) => {
    bounds = mergeBounds(bounds, {
      minX: rect.x,
      minY: rect.y,
      maxX: rect.x + rect.width,
      maxY: rect.y + rect.height,
    });
  });
  spec.geometry.lines.forEach((line) => {
    bounds = mergeBounds(bounds, {
      minX: Math.min(line.x1, line.x2),
      minY: Math.min(line.y1, line.y2),
      maxX: Math.max(line.x1, line.x2),
      maxY: Math.max(line.y1, line.y2),
    });
  });
  spec.geometry.polylines.forEach((polyline) => {
    const numbers = extractNumbers(polyline.points);
    if (numbers.length >= 2) {
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      for (let i = 0; i < numbers.length - 1; i += 2) {
        minX = Math.min(minX, numbers[i]);
        minY = Math.min(minY, numbers[i + 1]);
        maxX = Math.max(maxX, numbers[i]);
        maxY = Math.max(maxY, numbers[i + 1]);
      }
      if (Number.isFinite(minX)) {
        bounds = mergeBounds(bounds, { minX, minY, maxX, maxY });
      }
    }
  });

  const padding = spec.constraints.padding;
  if (bounds) {
    const strokePad = spec.style.strokeWidth / 2;
    const paddedBounds = {
      minX: bounds.minX - strokePad,
      minY: bounds.minY - strokePad,
      maxX: bounds.maxX + strokePad,
      maxY: bounds.maxY + strokePad,
    };
    metrics.estimatedStrokeBounds = paddedBounds;
    const limitMin = padding;
    const limitMax = spec.size - padding;
    if (
      paddedBounds.minX < limitMin ||
      paddedBounds.minY < limitMin ||
      paddedBounds.maxX > limitMax ||
      paddedBounds.maxY > limitMax
    ) {
      addIssue(issues, {
        code: "ICON_BOUNDS_001",
        message: "Geometry exceeds viewBox bounds or padding",
        severity: "error",
        jsonPath: "$.geometry",
        details: { padding, bounds: paddedBounds },
      });
    }
  }

  metrics.pathCount = spec.geometry.paths.length;
  metrics.totalPathCommands = spec.geometry.paths.reduce((sum, path) => {
    return sum + countPathCommands(path.d);
  }, 0);

  if (
    spec.constraints.maxTotalPathCommands &&
    metrics.totalPathCommands > spec.constraints.maxTotalPathCommands
  ) {
    addIssue(issues, {
      code: "ICON_COMPLEXITY_001",
      message: "Icon exceeds complexity guidance",
      severity: "warning",
      jsonPath: "$.geometry.paths",
      details: {
        maxTotalPathCommands: spec.constraints.maxTotalPathCommands,
        totalPathCommands: metrics.totalPathCommands,
      },
    });
  }

  if (spec.constraints.maxPaths && metrics.pathCount > spec.constraints.maxPaths) {
    addIssue(issues, {
      code: "ICON_COMPLEXITY_001",
      message: "Icon exceeds path count guidance",
      severity: "warning",
      jsonPath: "$.geometry.paths",
      details: {
        maxPaths: spec.constraints.maxPaths,
        pathCount: metrics.pathCount,
      },
    });
  }

  if (typeof spec.exports.svg !== "boolean") {
    addIssue(issues, {
      code: "ICON_EXPORT_001",
      message: "exports.svg must be a boolean",
      severity: "error",
      jsonPath: "$.exports.svg",
    });
  }
  if (!Array.isArray(spec.exports.png)) {
    addIssue(issues, {
      code: "ICON_EXPORT_002",
      message: "exports.png must be an array of sizes",
      severity: "error",
      jsonPath: "$.exports.png",
    });
  } else {
    spec.exports.png.forEach((size, index) => {
      if (!Number.isFinite(size) || size <= 0 || !Number.isInteger(size)) {
        addIssue(issues, {
          code: "ICON_EXPORT_003",
          message: "Export sizes must be positive integers",
          severity: "error",
          jsonPath: `$.exports.png[${index}]`,
        });
      }
    });
  }

  return {
    docType: "iconValidation",
    valid: issues.every((issue) => issue.severity !== "error"),
    issues,
    metrics,
  };
}
