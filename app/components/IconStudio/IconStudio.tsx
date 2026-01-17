"use client";

import { useState } from "react";
import { IconSpec, PresetKey } from "@/app/lib/iconSpec/schema";
import { sampleIcons } from "@/app/lib/iconSpec/samples";
import { IconRenderer } from "@/app/lib/iconSpec/render";
import { getPreset } from "@/app/lib/iconSpec/presets";
import { ChatPanel } from "./ChatPanel";
import { PresetGallery } from "./PresetGallery";
import { PreviewPanel } from "./PreviewPanel";

export function IconStudio() {
  const [currentSpec, setCurrentSpec] = useState<IconSpec>(sampleIcons[0]);
  const [selectedPreset, setSelectedPreset] = useState<PresetKey>(
    currentSpec.preset
  );
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePromptSubmit = async (prompt: string) => {
    setIsGenerating(true);
    setError(null);

    try {
      const response = await fetch("/api/icon-spec", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to generate icon");
      }

      // Apply current preset to the generated icon
      const preset = getPreset(selectedPreset);
      setCurrentSpec({
        ...data.iconSpec,
        preset: selectedPreset,
        strokeWidth: preset.strokeWidth,
        stroke: preset.stroke,
        fill: preset.fill,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);
      console.error("Generation error:", err);
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePresetChange = (preset: PresetKey) => {
    setSelectedPreset(preset);
    if (currentSpec) {
      const presetConfig = getPreset(preset);
      setCurrentSpec({
        ...currentSpec,
        preset,
        strokeWidth: presetConfig.strokeWidth,
        stroke: presetConfig.stroke,
        fill: presetConfig.fill,
      });
    }
  };

  const handleIconSelect = (icon: IconSpec) => {
    const preset = getPreset(selectedPreset);
    setCurrentSpec({
      ...icon,
      preset: selectedPreset,
      strokeWidth: preset.strokeWidth,
      stroke: preset.stroke,
      fill: preset.fill,
    });
  };

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <h1 className="text-xl font-bold">Icon Studio</h1>
        <span className="text-sm text-gray-500 dark:text-gray-400">v0.1</span>
      </header>

      {/* Main content - split pane */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left panel */}
        <div className="w-80 flex flex-col border-r border-gray-200 dark:border-gray-700 overflow-hidden">
          {/* Chat/Prompt section */}
          <ChatPanel onSubmit={handlePromptSubmit} disabled={isGenerating} />

          {/* Error message */}
          {error && (
            <div className="px-4 py-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Loading indicator */}
          {isGenerating && (
            <div className="px-4 py-3 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 text-sm flex items-center gap-2">
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Generating icon...
            </div>
          )}

          {/* Sample icons gallery */}
          <div className="flex-1 overflow-auto p-4 border-t border-gray-200 dark:border-gray-700">
            <h3 className="text-sm font-semibold mb-3 text-gray-700 dark:text-gray-300">
              Sample Icons
            </h3>
            <div className="grid grid-cols-3 gap-2">
              {sampleIcons.map((icon) => {
                const isSelected = currentSpec?.name === icon.name;
                return (
                  <button
                    key={icon.name}
                    onClick={() => handleIconSelect(icon)}
                    className={`flex flex-col items-center gap-1 p-2 rounded-lg border transition-colors ${
                      isSelected
                        ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                        : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
                    }`}
                    title={icon.name}
                  >
                    <IconRenderer
                      spec={{
                        ...icon,
                        preset: selectedPreset,
                        ...getPreset(selectedPreset),
                      }}
                      size={24}
                    />
                    <span className="text-xs truncate w-full text-center">
                      {icon.name}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Preset gallery */}
          <div className="border-t border-gray-200 dark:border-gray-700">
            <PresetGallery
              selectedPreset={selectedPreset}
              onPresetChange={handlePresetChange}
              currentSpec={currentSpec}
            />
          </div>
        </div>

        {/* Right panel - Preview */}
        <div className="flex-1 overflow-hidden">
          <PreviewPanel spec={currentSpec} />
        </div>
      </div>
    </div>
  );
}
