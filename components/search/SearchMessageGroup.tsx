"use client";

import { motion } from "framer-motion";
import type { ComponentSearchMessage } from "@/lib/search/types";

interface SearchMessageGroupProps {
  message: ComponentSearchMessage;
}

export function SearchMessageGroup({ message }: SearchMessageGroupProps) {
  const { response } = message;
  const hasResult = Boolean(response.componentCode);
  const lineRange =
    response.componentStartLine && response.componentEndLine
      ? `Lines ${response.componentStartLine}-${response.componentEndLine}`
      : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="mb-6"
    >
      <div className="mb-3">
        <span className="text-sm text-gray-500">You:</span>
        <p className="text-gray-800 mt-1">&quot;{message.description}&quot;</p>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-3">
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>{hasResult ? "Found component" : "No match found"}</span>
          <span className="uppercase tracking-wide">{response.confidence} confidence</span>
        </div>
        {response.foundFilePath && (
          <div className="mt-2 text-sm text-gray-700">
            File: <span className="font-mono">{response.foundFilePath}</span>
          </div>
        )}
        {(response.componentName || lineRange) && (
          <div className="mt-1 text-xs text-gray-500">
            {response.componentName ? `Component: ${response.componentName}` : "Component"}
            {lineRange ? ` (${lineRange})` : ""}
          </div>
        )}
        {response.reasoningSummary && (
          <p className="mt-2 text-sm text-gray-600">{response.reasoningSummary}</p>
        )}

        {response.componentCode ? (
          <details className="mt-3">
            <summary className="cursor-pointer text-xs text-gray-500">
              Component code
            </summary>
            <pre className="mt-2 max-h-64 overflow-auto rounded-md bg-gray-900 p-3 text-xs text-gray-100 whitespace-pre">
              {response.componentCode}
            </pre>
          </details>
        ) : response.suggestedNextQueries && response.suggestedNextQueries.length > 0 ? (
          <div className="mt-2 text-sm text-gray-600">
            Try:
            <div className="mt-1 flex flex-wrap gap-2">
              {response.suggestedNextQueries.map((query) => (
                <span
                  key={query}
                  className="rounded-full bg-gray-100 px-2 py-1 text-xs text-gray-600"
                >
                  {query}
                </span>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </motion.div>
  );
}
