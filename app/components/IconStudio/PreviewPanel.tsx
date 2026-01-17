"use client";

import { useState } from "react";
import { IconSpec } from "@/app/lib/iconSpec/schema";
import { IconRenderer } from "@/app/lib/iconSpec/render";
import { serializeSvg } from "@/app/lib/iconSpec/serializeSvg";
import { downloadSvg, downloadPng } from "@/app/lib/iconSpec/export";

type TabKey = "preview" | "spec" | "code" | "export";

interface PreviewPanelProps {
  spec: IconSpec | null;
}

const tabs: { key: TabKey; label: string }[] = [
  { key: "preview", label: "Preview" },
  { key: "spec", label: "Spec" },
  { key: "code", label: "Code" },
  { key: "export", label: "Export" },
];

const previewSizes = [24, 32, 48, 64, 96, 128];
const previewColors = [
  { name: "Default", value: "currentColor" },
  { name: "Black", value: "#000000" },
  { name: "White", value: "#ffffff" },
  { name: "Blue", value: "#3b82f6" },
  { name: "Red", value: "#ef4444" },
  { name: "Green", value: "#22c55e" },
];

export function PreviewPanel({ spec }: PreviewPanelProps) {
  const [activeTab, setActiveTab] = useState<TabKey>("preview");
  const [previewColor, setPreviewColor] = useState("currentColor");
  const [exportColor, setExportColor] = useState("#000000");
  const [copiedCode, setCopiedCode] = useState(false);

  const handleCopyCode = async (code: string) => {
    await navigator.clipboard.writeText(code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleDownloadSvg = () => {
    if (spec) {
      downloadSvg(spec, exportColor);
    }
  };

  const handleDownloadPng = async (size: number) => {
    if (spec) {
      await downloadPng(spec, size, exportColor);
    }
  };

  if (!spec) {
    return (
      <div className="h-full flex items-center justify-center text-gray-500 dark:text-gray-400">
        <p>Select or generate an icon to preview</p>
      </div>
    );
  }

  const svgCode = serializeSvg(spec);
  const specJson = JSON.stringify(spec, null, 2);

  return (
    <div className="h-full flex flex-col">
      {/* Tabs */}
      <div className="flex border-b border-gray-200 dark:border-gray-700">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? "text-blue-600 border-b-2 border-blue-600"
                : "text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-auto p-4">
        {activeTab === "preview" && (
          <div className="space-y-6">
            {/* Color selector */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Preview Color
              </label>
              <div className="flex flex-wrap gap-2">
                {previewColors.map((color) => (
                  <button
                    key={color.value}
                    onClick={() => setPreviewColor(color.value)}
                    className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                      previewColor === color.value
                        ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                        : "border-gray-300 dark:border-gray-600"
                    }`}
                  >
                    <span
                      className="inline-block w-3 h-3 rounded-full mr-1.5 border border-gray-300"
                      style={{
                        backgroundColor:
                          color.value === "currentColor"
                            ? "currentColor"
                            : color.value,
                      }}
                    />
                    {color.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Size previews */}
            <div className="grid grid-cols-3 gap-6">
              {previewSizes.map((size) => (
                <div
                  key={size}
                  className="flex flex-col items-center gap-2 p-4 rounded-lg bg-gray-50 dark:bg-gray-800"
                >
                  <div
                    className="flex items-center justify-center"
                    style={{
                      minHeight: Math.max(size, 48),
                      color:
                        previewColor === "currentColor"
                          ? undefined
                          : previewColor,
                    }}
                  >
                    <IconRenderer spec={spec} size={size} color={previewColor} />
                  </div>
                  <span className="text-xs text-gray-500">{size}px</span>
                </div>
              ))}
            </div>

            {/* Dark/Light background preview */}
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col items-center gap-2 p-6 rounded-lg bg-white border border-gray-200">
                <IconRenderer spec={spec} size={64} color="#000000" />
                <span className="text-xs text-gray-500">Light background</span>
              </div>
              <div className="flex flex-col items-center gap-2 p-6 rounded-lg bg-gray-900 border border-gray-700">
                <IconRenderer spec={spec} size={64} color="#ffffff" />
                <span className="text-xs text-gray-400">Dark background</span>
              </div>
            </div>
          </div>
        )}

        {activeTab === "spec" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium">IconSpec JSON</h3>
              <button
                onClick={() => handleCopyCode(specJson)}
                className="px-3 py-1 text-xs bg-gray-100 dark:bg-gray-700 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                {copiedCode ? "Copied!" : "Copy"}
              </button>
            </div>
            <pre className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg overflow-auto text-xs font-mono">
              {specJson}
            </pre>
          </div>
        )}

        {activeTab === "code" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium">SVG Code</h3>
              <button
                onClick={() => handleCopyCode(svgCode)}
                className="px-3 py-1 text-xs bg-gray-100 dark:bg-gray-700 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                {copiedCode ? "Copied!" : "Copy"}
              </button>
            </div>
            <pre className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg overflow-auto text-xs font-mono whitespace-pre-wrap">
              {svgCode}
            </pre>
          </div>
        )}

        {activeTab === "export" && (
          <div className="space-y-6">
            {/* Export color */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Export Color
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={exportColor}
                  onChange={(e) => setExportColor(e.target.value)}
                  className="w-10 h-10 rounded cursor-pointer"
                />
                <input
                  type="text"
                  value={exportColor}
                  onChange={(e) => setExportColor(e.target.value)}
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-sm font-mono w-28"
                />
              </div>
            </div>

            {/* SVG download */}
            <div>
              <h3 className="text-sm font-medium mb-3">SVG</h3>
              <button
                onClick={handleDownloadSvg}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Download SVG
              </button>
            </div>

            {/* PNG downloads */}
            <div>
              <h3 className="text-sm font-medium mb-3">PNG</h3>
              <div className="flex flex-wrap gap-2">
                {spec.exports.png.map((size) => (
                  <button
                    key={size}
                    onClick={() => handleDownloadPng(size)}
                    className="px-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                  >
                    {size}px
                  </button>
                ))}
              </div>
            </div>

            {/* Preview with export color */}
            <div>
              <h3 className="text-sm font-medium mb-3">Preview</h3>
              <div className="inline-flex p-6 rounded-lg border border-gray-200 dark:border-gray-700">
                <IconRenderer spec={spec} size={64} color={exportColor} />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
