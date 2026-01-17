"use client";

import type { ComponentSearchResponse } from "@/lib/search/types";

interface SearchResultProps {
  result: ComponentSearchResponse | null;
  isLoading: boolean;
}

export function SearchResult({ result, isLoading }: SearchResultProps) {
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

  const hasResult = Boolean(result.componentCode);
  const lineRange =
    result.componentStartLine && result.componentEndLine
      ? `Lines ${result.componentStartLine}-${result.componentEndLine}`
      : null;

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
