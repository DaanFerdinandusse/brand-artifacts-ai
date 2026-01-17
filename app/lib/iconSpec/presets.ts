import { PresetKey } from "./schema";

export interface IconPresetDefinition {
  id: PresetKey;
  name: string;
  description: string;
  recommendedSizes: number[];
  strokeWidthBySize: Record<number, number>;
  paddingBySize: Record<number, number>;
  style: {
    stroke: string;
    fill: string;
    strokeLinecap: "round" | "square" | "butt";
    strokeLinejoin: "round" | "miter" | "bevel";
  };
  constraints: {
    gridSize: number;
    maxTotalPathCommands?: number;
    maxPaths?: number;
  };
}

const outlineStrokeWidthBySize = {
  16: 1.5,
  20: 1.75,
  24: 2,
  32: 2.5,
  48: 3,
};

const outlinePaddingBySize = {
  16: 1,
  20: 2,
  24: 2,
  32: 3,
  48: 4,
};

const solidPaddingBySize = {
  16: 1,
  20: 1,
  24: 2,
  32: 2,
  48: 3,
};

export const iconPresetRegistry: Record<PresetKey, IconPresetDefinition> = {
  outline_rounded: {
    id: "outline_rounded",
    name: "Outline Rounded",
    description: "Clean outlines with rounded corners and caps",
    recommendedSizes: [16, 20, 24, 32, 48],
    strokeWidthBySize: outlineStrokeWidthBySize,
    paddingBySize: outlinePaddingBySize,
    style: {
      stroke: "currentColor",
      fill: "none",
      strokeLinecap: "round",
      strokeLinejoin: "round",
    },
    constraints: {
      gridSize: 1,
      maxTotalPathCommands: 160,
      maxPaths: 8,
    },
  },
  outline_sharp: {
    id: "outline_sharp",
    name: "Outline Sharp",
    description: "Crisp outlines with square corners and caps",
    recommendedSizes: [16, 20, 24, 32, 48],
    strokeWidthBySize: outlineStrokeWidthBySize,
    paddingBySize: outlinePaddingBySize,
    style: {
      stroke: "currentColor",
      fill: "none",
      strokeLinecap: "square",
      strokeLinejoin: "miter",
    },
    constraints: {
      gridSize: 1,
      maxTotalPathCommands: 160,
      maxPaths: 8,
    },
  },
  solid: {
    id: "solid",
    name: "Solid",
    description: "Filled shapes with no stroke",
    recommendedSizes: [16, 20, 24, 32, 48],
    strokeWidthBySize: {
      16: 0,
      20: 0,
      24: 0,
      32: 0,
      48: 0,
    },
    paddingBySize: solidPaddingBySize,
    style: {
      stroke: "none",
      fill: "currentColor",
      strokeLinecap: "round",
      strokeLinejoin: "round",
    },
    constraints: {
      gridSize: 1,
      maxTotalPathCommands: 160,
      maxPaths: 8,
    },
  },
  duotone: {
    id: "duotone",
    name: "Duotone",
    description: "Two-tone style with shared fill/stroke",
    recommendedSizes: [16, 20, 24, 32, 48],
    strokeWidthBySize: outlineStrokeWidthBySize,
    paddingBySize: outlinePaddingBySize,
    style: {
      stroke: "currentColor",
      fill: "currentColor",
      strokeLinecap: "round",
      strokeLinejoin: "round",
    },
    constraints: {
      gridSize: 1,
      maxTotalPathCommands: 160,
      maxPaths: 8,
    },
  },
};

export const iconPresetKeys = Object.keys(iconPresetRegistry) as PresetKey[];

export function getPreset(id: PresetKey): IconPresetDefinition {
  return iconPresetRegistry[id];
}

export function getStrokeWidthForSize(
  preset: IconPresetDefinition,
  size: number
): number {
  return preset.strokeWidthBySize[size] ?? preset.strokeWidthBySize[24] ?? 2;
}

export function getPaddingForSize(
  preset: IconPresetDefinition,
  size: number
): number {
  return preset.paddingBySize[size] ?? preset.paddingBySize[24] ?? 2;
}
