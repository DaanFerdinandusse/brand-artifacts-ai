import { PresetKey } from "./schema";

export interface PresetConfig {
  key: PresetKey;
  name: string;
  description: string;
  strokeWidth: number;
  stroke: string;
  fill: string;
  strokeLinecap: "round" | "square" | "butt";
  strokeLinejoin: "round" | "miter" | "bevel";
}

export const presets: Record<PresetKey, PresetConfig> = {
  outline_rounded: {
    key: "outline_rounded",
    name: "Outline Rounded",
    description: "Clean outlines with rounded corners and caps",
    strokeWidth: 2,
    stroke: "currentColor",
    fill: "none",
    strokeLinecap: "round",
    strokeLinejoin: "round",
  },
  outline_sharp: {
    key: "outline_sharp",
    name: "Outline Sharp",
    description: "Crisp outlines with square corners and caps",
    strokeWidth: 2,
    stroke: "currentColor",
    fill: "none",
    strokeLinecap: "square",
    strokeLinejoin: "miter",
  },
  solid: {
    key: "solid",
    name: "Solid",
    description: "Filled shapes with no stroke",
    strokeWidth: 0,
    stroke: "none",
    fill: "currentColor",
    strokeLinecap: "round",
    strokeLinejoin: "round",
  },
  duotone: {
    key: "duotone",
    name: "Duotone",
    description: "Two-tone style with fill and stroke",
    strokeWidth: 2,
    stroke: "currentColor",
    fill: "currentColor",
    strokeLinecap: "round",
    strokeLinejoin: "round",
  },
};

export const presetKeys = Object.keys(presets) as PresetKey[];

export function getPreset(key: PresetKey): PresetConfig {
  return presets[key];
}

export function applyPresetToSpec(
  spec: { strokeWidth: number; stroke: string; fill: string },
  presetKey: PresetKey
): { strokeWidth: number; stroke: string; fill: string } {
  const preset = getPreset(presetKey);
  return {
    ...spec,
    strokeWidth: preset.strokeWidth,
    stroke: preset.stroke,
    fill: preset.fill,
  };
}
