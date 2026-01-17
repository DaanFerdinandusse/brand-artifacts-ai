"use client";

import { PresetKey, iconPresetKeys, iconPresetRegistry } from "@/app/lib/iconSpec";
import { IconDraft } from "@/app/lib/iconSpec/schema";
import { IconRenderer } from "@/app/lib/iconSpec/render";
import { iconPresetApply } from "@/app/lib/iconSpec/tools/presetApply";

interface PresetGalleryProps {
  selectedPreset: PresetKey;
  onPresetChange: (preset: PresetKey) => void;
  currentDraft: IconDraft | null;
}

export function PresetGallery({
  selectedPreset,
  onPresetChange,
  currentDraft,
}: PresetGalleryProps) {
  return (
    <div className="p-4">
      <h3 className="text-sm font-semibold mb-3 text-gray-700 dark:text-gray-300">
        Style Presets
      </h3>
      <div className="grid grid-cols-2 gap-3">
        {iconPresetKeys.map((key) => {
          const preset = iconPresetRegistry[key];
          const isSelected = selectedPreset === key;

          // Create a preview spec if we have a current draft
          const previewExpanded = currentDraft
            ? {
                ...iconPresetApply({ ...currentDraft, preset: key }).expanded,
              }
            : null;

          return (
            <button
              key={key}
              onClick={() => onPresetChange(key)}
              className={`flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-colors ${
                isSelected
                  ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                  : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
              }`}
            >
              <div className="w-10 h-10 flex items-center justify-center">
                {previewExpanded ? (
                  <IconRenderer spec={previewExpanded} size={32} />
                ) : (
                  <div className="w-8 h-8 rounded bg-gray-200 dark:bg-gray-700" />
                )}
              </div>
              <span className="text-xs font-medium text-center">
                {preset.name}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
