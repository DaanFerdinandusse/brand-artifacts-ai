"use client";

import { useEffect, useState } from "react";
import type { ComponentSearchResponse } from "@/lib/search/types";

interface SearchResultProps {
  result: ComponentSearchResponse | null;
  isLoading: boolean;
  description: string;
}

export function SearchResult({ result, isLoading, description }: SearchResultProps) {
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewRuntimeError, setPreviewRuntimeError] = useState<string | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);

  const foundFilePath = result?.foundFilePath ?? null;
  const componentName = result?.componentName ?? null;
  const componentCode = result?.componentCode ?? null;
  const canPreview = Boolean(foundFilePath);
  const hasResult = Boolean(result?.componentCode);
  const lineRange =
    result?.componentStartLine && result?.componentEndLine
      ? `Lines ${result.componentStartLine}-${result.componentEndLine}`
      : null;

  const requestPreview = async (
    filePath: string | null,
    name: string | null,
    code: string | null,
    prompt: string
  ) => {
    if (!filePath) {
      return;
    }

    setIsPreviewLoading(true);
    setPreviewError(null);
    setPreviewRuntimeError(null);
    setPreviewHtml(null);

    try {
      const response = await fetch("/api/chat/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          foundFilePath: filePath,
          componentName: name,
          componentCode: code,
          description: prompt,
        }),
      });

      const payload = (await response.json()) as { html?: string; error?: string };

      if (!response.ok) {
        setPreviewError(payload.error || "Preview build failed.");
        return;
      }

      setPreviewHtml(payload.html ?? null);
    } catch (fetchError) {
      setPreviewError(
        fetchError instanceof Error ? fetchError.message : "Preview build failed."
      );
    } finally {
      setIsPreviewLoading(false);
    }
  };

  useEffect(() => {
    if (!canPreview) {
      setPreviewHtml(null);
      setPreviewError(null);
      setPreviewRuntimeError(null);
      setIsPreviewLoading(false);
      return;
    }

    void requestPreview(foundFilePath, componentName, componentCode, description);
  }, [foundFilePath, componentName, componentCode, description, canPreview]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (!event.data || typeof event.data !== "object") {
        return;
      }
      const data = event.data as { type?: string; message?: string; stack?: string };
      if (data.type !== "component-preview-error") {
        return;
      }
      const message = data.message ?? "Preview runtime error.";
      const stack = data.stack ? `\n${data.stack}` : "";
      setPreviewRuntimeError(`${message}${stack}`);
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  if (!result && !isLoading) {
    return null;
  }

  if (isLoading && !result) {
    return (
      <div className="w-full max-w-4xl mt-6 rounded-lg border border-gray-200 bg-white p-4">
        <div className="text-xs text-gray-400 uppercase tracking-wide mb-2">
          Searching
        </div>
        <div className="text-sm text-gray-600">Looking for the best match...</div>
      </div>
    );
  }

  if (!result) {
    return null;
  }

  return (
    <div className="w-full max-w-4xl mt-6 rounded-lg border border-gray-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-400 uppercase tracking-wide">
          Latest Result
        </span>
        <span className="text-xs text-gray-500 uppercase tracking-wide">
          {result.confidence} confidence
        </span>
      </div>

      {result.foundFilePath && (
        <div className="mt-3 text-sm text-gray-700">
          File: <span className="font-mono">{result.foundFilePath}</span>
        </div>
      )}
      {(result.componentName || lineRange) && (
        <div className="mt-2 text-xs text-gray-500">
          {result.componentName ? `Component: ${result.componentName}` : "Component"}
          {lineRange ? ` (${lineRange})` : ""}
        </div>
      )}

      {result.reasoningSummary && (
        <p className="mt-2 text-sm text-gray-600">{result.reasoningSummary}</p>
      )}

      {hasResult ? (
        <div className="mt-4">
          <div className="text-xs text-gray-400 uppercase tracking-wide mb-2">
            Component
          </div>
          <pre className="max-h-[50vh] overflow-auto rounded-md bg-gray-900 p-4 text-xs text-gray-100 whitespace-pre">
            {result.componentCode}
          </pre>
        </div>
      ) : (
        <div className="mt-3 text-sm text-gray-600">
          {result.foundFilePath
            ? "Found a file but could not extract a component yet."
            : "No component found in this pass."}
          {result.suggestedNextQueries && result.suggestedNextQueries.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {result.suggestedNextQueries.map((query) => (
                <span
                  key={query}
                  className="rounded-full bg-gray-100 px-2 py-1 text-xs text-gray-600"
                >
                  {query}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="mt-6 border border-gray-200 rounded-lg bg-white">
        <div className="px-4 py-2 border-b border-gray-200 text-xs uppercase tracking-wide text-gray-400 flex items-center justify-between">
          <span>Preview sandbox</span>
          <button
            type="button"
            onClick={() =>
              void requestPreview(foundFilePath, componentName, componentCode, description)
            }
            disabled={!canPreview || isPreviewLoading}
            className="text-xs text-blue-600 hover:text-blue-700 disabled:text-gray-400"
          >
            {isPreviewLoading ? "Rendering..." : "Refresh preview"}
          </button>
        </div>
        <div className="p-4">
          {!canPreview && (
            <div className="text-sm text-gray-500">
              Preview requires a resolved file. Try a more specific prompt.
            </div>
          )}
          {previewError && (
            <div className="mb-3 text-sm text-red-600">
              Preview build error: {previewError}
            </div>
          )}
          {previewRuntimeError && (
            <div className="mb-3 text-sm text-red-600 whitespace-pre-wrap">
              Preview runtime error: {previewRuntimeError}
            </div>
          )}
          {isPreviewLoading && !previewHtml && (
            <div className="text-sm text-gray-500">Rendering preview...</div>
          )}
          {previewHtml && (
            <iframe
              title="Component preview"
              srcDoc={previewHtml}
              sandbox="allow-scripts"
              className="w-full h-[420px] border border-gray-200 rounded-lg"
            />
          )}
        </div>
      </div>

      {result.toolTrace && result.toolTrace.length > 0 && (
        <details className="mt-4">
          <summary className="cursor-pointer text-xs text-gray-500">
            Tool trace
          </summary>
          <pre className="mt-2 max-h-48 overflow-auto rounded-md bg-gray-50 p-3 text-xs text-gray-600 whitespace-pre">
            {JSON.stringify(result.toolTrace, null, 2)}
          </pre>
        </details>
      )}
    </div>
  );
}
