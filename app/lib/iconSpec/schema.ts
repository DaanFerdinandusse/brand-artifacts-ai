import { z } from "zod";

// Preset keys for icon styles
export const PresetKeySchema = z.enum([
  "outline_rounded",
  "outline_sharp",
  "solid",
  "duotone",
]);
export type PresetKey = z.infer<typeof PresetKeySchema>;

// Path element schema
export const PathElementSchema = z.object({
  d: z.string(),
  fill: z.string().optional(),
  stroke: z.string().optional(),
  strokeWidth: z.number().optional(),
  opacity: z.number().min(0).max(1).optional(),
});
export type PathElement = z.infer<typeof PathElementSchema>;

// Circle element schema
export const CircleElementSchema = z.object({
  cx: z.number(),
  cy: z.number(),
  r: z.number(),
  fill: z.string().optional(),
  stroke: z.string().optional(),
  strokeWidth: z.number().optional(),
  opacity: z.number().min(0).max(1).optional(),
});
export type CircleElement = z.infer<typeof CircleElementSchema>;

// Rect element schema
export const RectElementSchema = z.object({
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
  rx: z.number().optional(),
  ry: z.number().optional(),
  fill: z.string().optional(),
  stroke: z.string().optional(),
  strokeWidth: z.number().optional(),
  opacity: z.number().min(0).max(1).optional(),
});
export type RectElement = z.infer<typeof RectElementSchema>;

// Line element schema
export const LineElementSchema = z.object({
  x1: z.number(),
  y1: z.number(),
  x2: z.number(),
  y2: z.number(),
  stroke: z.string().optional(),
  strokeWidth: z.number().optional(),
  opacity: z.number().min(0).max(1).optional(),
});
export type LineElement = z.infer<typeof LineElementSchema>;

// Export settings schema
export const ExportSettingsSchema = z.object({
  svg: z.boolean().default(true),
  png: z.array(z.number()).default([64, 128, 256]),
});
export type ExportSettings = z.infer<typeof ExportSettingsSchema>;

// Main IconSpec schema
export const IconSpecSchema = z.object({
  docType: z.literal("icon"),
  name: z.string().min(1),
  preset: PresetKeySchema,
  size: z.number().positive().default(24),
  viewBox: z.string().default("0 0 24 24"),
  strokeWidth: z.number().nonnegative().default(2),
  stroke: z.string().default("currentColor"),
  fill: z.string().default("none"),
  paths: z.array(PathElementSchema).default([]),
  circles: z.array(CircleElementSchema).optional().default([]),
  rects: z.array(RectElementSchema).optional().default([]),
  lines: z.array(LineElementSchema).optional().default([]),
  exports: ExportSettingsSchema.default({ svg: true, png: [64, 128, 256] }),
});

export type IconSpec = z.infer<typeof IconSpecSchema>;

// Validation helper
export function validateIconSpec(data: unknown): {
  success: boolean;
  data?: IconSpec;
  error?: z.ZodError;
} {
  const result = IconSpecSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error };
}

// Create a default IconSpec
export function createDefaultIconSpec(
  name: string = "untitled",
  preset: PresetKey = "outline_rounded"
): IconSpec {
  return {
    docType: "icon",
    name,
    preset,
    size: 24,
    viewBox: "0 0 24 24",
    strokeWidth: 2,
    stroke: "currentColor",
    fill: "none",
    paths: [],
    circles: [],
    rects: [],
    lines: [],
    exports: { svg: true, png: [64, 128, 256] },
  };
}
