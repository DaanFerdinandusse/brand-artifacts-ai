import { iconPresetKeys, iconPresetRegistry } from "../presets";
import { IconPresetListResult } from "../schema";

export function iconPresetList(): IconPresetListResult {
  return {
    docType: "iconPresetList",
    presets: iconPresetKeys.map((id) => ({
      id,
      recommendedSizes: iconPresetRegistry[id].recommendedSizes,
    })),
  };
}
