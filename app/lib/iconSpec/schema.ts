import { z } from "zod";

// Preset keys for icon styles
export const PresetKeySchema = z.enum([
  "outline_rounded",
  "outline_sharp",
  "solid",
  "duotone",
]);
export type PresetKey = z.infer<typeof PresetKeySchema>;

export const ExportSettingsSchema = z.object({
  svg: z.boolean().default(true),
  png: z.array(z.number().positive()).default([64, 128, 256]),
});
export type ExportSettings = z.infer<typeof ExportSettingsSchema>;

// Geometry-only schemas (no per-shape styling)
export const PathGeometrySchema = z.object({
  d: z.string().min(1),
});
export type PathGeometry = z.infer<typeof PathGeometrySchema>;

export const CircleGeometrySchema = z.object({
  cx: z.number(),
  cy: z.number(),
  r: z.number().positive(),
});
export type CircleGeometry = z.infer<typeof CircleGeometrySchema>;

export const RectGeometrySchema = z.object({
  x: z.number(),
  y: z.number(),
  width: z.number().positive(),
  height: z.number().positive(),
  rx: z.number().optional(),
  ry: z.number().optional(),
});
export type RectGeometry = z.infer<typeof RectGeometrySchema>;

export const LineGeometrySchema = z.object({
  x1: z.number(),
  y1: z.number(),
  x2: z.number(),
  y2: z.number(),
});
export type LineGeometry = z.infer<typeof LineGeometrySchema>;

export const PolylineGeometrySchema = z.object({
  points: z.string().min(1),
});
export type PolylineGeometry = z.infer<typeof PolylineGeometrySchema>;

export const IconGeometrySchema = z.object({
  paths: z.array(PathGeometrySchema).default([]),
  circles: z.array(CircleGeometrySchema).default([]),
  rects: z.array(RectGeometrySchema).default([]),
  lines: z.array(LineGeometrySchema).default([]),
  polylines: z.array(PolylineGeometrySchema).default([]),
});
export type IconGeometry = z.infer<typeof IconGeometrySchema>;

// Draft schema (authoring)
export const IconDraftSchema = z.object({
  // Accept both legacy ("iconDraft") and contract ("icon") docTypes.
  docType: z.enum(["iconDraft", "icon"]),
  name: z.string().min(1),
  preset: PresetKeySchema,
  size: z.number().positive().default(24),
  viewBox: z.string().default("0 0 24 24"),
  paths: z.array(PathGeometrySchema).default([]),
  circles: z.array(CircleGeometrySchema).default([]),
  rects: z.array(RectGeometrySchema).default([]),
  lines: z.array(LineGeometrySchema).default([]),
  polylines: z.array(PolylineGeometrySchema).default([]),
  exports: ExportSettingsSchema.default({ svg: true, png: [64, 128, 256] }),
});
export type IconDraft = z.infer<typeof IconDraftSchema>;

export const IconStyleSchema = z.object({
  strokeWidth: z.number().nonnegative(),
  stroke: z.string(),
  fill: z.string(),
  strokeLinecap: z.enum(["round", "square", "butt"]),
  strokeLinejoin: z.enum(["round", "miter", "bevel"]),
});
export type IconStyle = z.infer<typeof IconStyleSchema>;

export const IconConstraintsSchema = z.object({
  gridSize: z.number().positive().default(1),
  padding: z.number().nonnegative().default(2),
  maxTotalPathCommands: z.number().positive().optional(),
  maxPaths: z.number().positive().optional(),
});
export type IconConstraints = z.infer<typeof IconConstraintsSchema>;

export const IconSpecExpandedSchema = z.object({
  docType: z.literal("iconExpanded"),
  name: z.string().min(1),
  preset: PresetKeySchema,
  size: z.number().positive(),
  viewBox: z.string(),
  style: IconStyleSchema,
  constraints: IconConstraintsSchema,
  geometry: IconGeometrySchema,
  exports: ExportSettingsSchema,
});
export type IconSpecExpanded = z.infer<typeof IconSpecExpandedSchema>;

// Tool request/response schemas
export const IconPresetListItemSchema = z.object({
  id: PresetKeySchema,
  recommendedSizes: z.array(z.number().positive()),
});
export const IconPresetListResultSchema = z.object({
  docType: z.literal("iconPresetList"),
  presets: z.array(IconPresetListItemSchema),
});
export type IconPresetListResult = z.infer<typeof IconPresetListResultSchema>;

export const IconPresetApplyOptionsSchema = z
  .object({
    normalize: z.boolean().default(true),
    snapToGrid: z.boolean().default(true),
    fillMissingDefaults: z.boolean().default(true),
  })
  .default({ normalize: true, snapToGrid: true, fillMissingDefaults: true });
export type IconPresetApplyOptions = z.infer<
  typeof IconPresetApplyOptionsSchema
>;

export const IconPresetApplyChangeSchema = z.object({
  type: z.string(),
  path: z.string().optional(),
  before: z.unknown().optional(),
  after: z.unknown().optional(),
  note: z.string().optional(),
});
export type IconPresetApplyChange = z.infer<
  typeof IconPresetApplyChangeSchema
>;

export const IconPresetApplyInputSchema = z.object({
  draft: IconDraftSchema,
  options: IconPresetApplyOptionsSchema.optional(),
});
export type IconPresetApplyInput = z.infer<typeof IconPresetApplyInputSchema>;

export const IconPresetApplyResultSchema = z.object({
  docType: z.literal("iconPresetApplyResult"),
  expanded: IconSpecExpandedSchema,
  changes: z.array(IconPresetApplyChangeSchema),
});
export type IconPresetApplyResult = z.infer<typeof IconPresetApplyResultSchema>;

// Tool-call input (server agent): accept either legacy `{ expanded }` or contract `{ spec }`.
export const IconValidateInputSchema = z.union([
  z.object({
    docType: z.literal("iconValidateRequest"),
    spec: IconSpecExpandedSchema,
  }),
  z.object({
    spec: IconSpecExpandedSchema,
  }),
  z.object({
    expanded: IconSpecExpandedSchema,
  }),
]);
export type IconValidateInput = z.infer<typeof IconValidateInputSchema>;

export const IconValidationIssueSchema = z.object({
  code: z.string(),
  message: z.string(),
  severity: z.enum(["error", "warning"]),
  jsonPath: z.string(),
  details: z.record(z.unknown()).optional(),
});
export type IconValidationIssue = z.infer<typeof IconValidationIssueSchema>;

export const IconValidationMetricsSchema = z.object({
  pathCount: z.number(),
  totalPathCommands: z.number(),
  estimatedStrokeBounds: z
    .object({
      minX: z.number(),
      minY: z.number(),
      maxX: z.number(),
      maxY: z.number(),
    })
    .optional(),
});
export type IconValidationMetrics = z.infer<
  typeof IconValidationMetricsSchema
>;

export const IconValidationResultSchema = z.object({
  docType: z.literal("iconValidation"),
  valid: z.boolean(),
  issues: z.array(IconValidationIssueSchema),
  metrics: IconValidationMetricsSchema,
});
export type IconValidationResult = z.infer<typeof IconValidationResultSchema>;

export const IconCompileInputSchema = z.union([
  z.object({
    docType: z.literal("iconCompileSvgRequest"),
    spec: IconSpecExpandedSchema,
    options: z
      .object({
        pretty: z.boolean().default(true),
        dedupeAttributes: z.boolean().default(true),
        placeStyleOnRoot: z.boolean().default(true),
      })
      .optional(),
  }),
  z.object({
    spec: IconSpecExpandedSchema,
    options: z
      .object({
        pretty: z.boolean().default(true),
        dedupeAttributes: z.boolean().default(true),
        placeStyleOnRoot: z.boolean().default(true),
      })
      .optional(),
  }),
  z.object({
    expanded: IconSpecExpandedSchema,
  }),
]);
export type IconCompileInput = z.infer<typeof IconCompileInputSchema>;

export const IconCompileSuccessSchema = z.object({
  docType: z.literal("iconCompileResult"),
  ok: z.literal(true),
  svg: z.string(),
  svgMin: z.string(),
  metadata: z.object({
    size: z.number(),
    viewBox: z.string(),
    pathCount: z.number(),
    totalPathCommands: z.number(),
    strokeWidth: z.number(),
    padding: z.number(),
  }),
});
export type IconCompileSuccess = z.infer<typeof IconCompileSuccessSchema>;

export const IconCompileErrorSchema = z.object({
  docType: z.literal("iconCompileError"),
  ok: z.literal(false),
  issues: z.array(IconValidationIssueSchema),
});
export type IconCompileError = z.infer<typeof IconCompileErrorSchema>;

export const IconCompileResultSchema = z.union([
  IconCompileSuccessSchema,
  IconCompileErrorSchema,
]);
export type IconCompileResult = z.infer<typeof IconCompileResultSchema>;
