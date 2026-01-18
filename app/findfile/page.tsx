"use client";

import { useState, useEffect, type FormEvent } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { PromptInput } from "@/components/generation/PromptInput";

interface FindFileResponse {
  filePath: string;
  functionName: string;
  matchCount: number;
  matchKind: string;
  startLine: number;
  startColumn: number;
  functionText: string;
  summary: string | null;
  summaryError: string | null;
  alternateMatches: Array<{
    kind: string;
    startLine: number;
    startColumn: number;
  }>;
}

interface ErrorPayload {
  error: string;
  candidates?: string[];
  availableFunctions?: string[];
}

interface FindComponentResponse {
  filePath: string;
  componentName: string;
  componentText: string;
  matchKind: string;
  startLine: number;
  startColumn: number;
  matchCount: number;
  summary: string | null;
}

interface PreviewResponse {
  html: string;
}

export default function FindFilePage() {
  const [mode, setMode] = useState<"function" | "component">("function");
  const [filePath, setFilePath] = useState("");
  const [functionName, setFunctionName] = useState("");
  const [result, setResult] = useState<FindFileResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<string[]>([]);
  const [availableFunctions, setAvailableFunctions] = useState<string[]>([]);
  const [isFunctionLoading, setIsFunctionLoading] = useState(false);

  const [componentResult, setComponentResult] =
    useState<FindComponentResponse | null>(null);
  const [componentError, setComponentError] = useState<string | null>(null);
  const [componentCandidates, setComponentCandidates] = useState<string[]>([]);
  const [componentAvailableFunctions, setComponentAvailableFunctions] = useState<
    string[]
  >([]);
  const [isComponentLoading, setIsComponentLoading] = useState(false);

  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewRuntimeError, setPreviewRuntimeError] = useState<string | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);

  const handleModeChange = (nextMode: "function" | "component") => {
    setMode(nextMode);
    setError(null);
    setCandidates([]);
    setAvailableFunctions([]);
    setResult(null);
    setComponentError(null);
    setComponentCandidates([]);
    setComponentAvailableFunctions([]);
    setComponentResult(null);
    setPreviewHtml(null);
    setPreviewError(null);
    setPreviewRuntimeError(null);
    setIsFunctionLoading(false);
    setIsComponentLoading(false);
    setIsPreviewLoading(false);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsFunctionLoading(true);
    setError(null);
    setCandidates([]);
    setAvailableFunctions([]);
    setResult(null);

    try {
      const response = await fetch("/api/findfile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filePath, functionName }),
      });

      const data = (await response.json()) as FindFileResponse & ErrorPayload;

      if (!response.ok) {
        setError(data.error || "Request failed.");
        setCandidates(data.candidates ?? []);
        setAvailableFunctions(data.availableFunctions ?? []);
        return;
      }

      setResult(data);
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : "Request failed.");
    } finally {
      setIsFunctionLoading(false);
    }
  };

  const handleComponentSubmit = async (prompt: string) => {
    setIsComponentLoading(true);
    setComponentError(null);
    setComponentCandidates([]);
    setComponentAvailableFunctions([]);
    setComponentResult(null);
    setPreviewHtml(null);
    setPreviewError(null);
    setPreviewRuntimeError(null);
    setIsPreviewLoading(false);

    try {
      const response = await fetch("/api/findcomponent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });

      const data = (await response.json()) as FindComponentResponse & ErrorPayload;

      if (!response.ok) {
        setComponentError(data.error || "Request failed.");
        setComponentCandidates(data.candidates ?? []);
        setComponentAvailableFunctions(data.availableFunctions ?? []);
        return;
      }

      setComponentResult(data);
    } catch (fetchError) {
      setComponentError(
        fetchError instanceof Error ? fetchError.message : "Request failed."
      );
    } finally {
      setIsComponentLoading(false);
    }
  };

  const requestPreview = async (data: FindComponentResponse) => {
    setIsPreviewLoading(true);
    setPreviewError(null);
    setPreviewRuntimeError(null);
    setPreviewHtml(null);

    try {
      const response = await fetch("/api/findcomponent/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filePath: data.filePath,
          componentName: data.componentName,
        }),
      });

      const payload = (await response.json()) as PreviewResponse & ErrorPayload;

      if (!response.ok) {
        setPreviewError(payload.error || "Preview build failed.");
        return;
      }

      setPreviewHtml(payload.html);
    } catch (fetchError) {
      setPreviewError(
        fetchError instanceof Error ? fetchError.message : "Preview build failed."
      );
    } finally {
      setIsPreviewLoading(false);
    }
  };

  useEffect(() => {
    if (!componentResult) {
      return;
    }

    void requestPreview(componentResult);
  }, [componentResult]);

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

  return (
    <main className="min-h-screen flex flex-col items-center px-4 py-10">
      <div className="w-full max-w-4xl">
        <div className="flex flex-col gap-4 mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold text-gray-800">Find in Repo</h1>
              <p className="text-sm text-gray-500 mt-1">
                {mode === "function"
                  ? "Locate a function by file path and name."
                  : "Describe a component and let the assistant search the codebase."}
              </p>
            </div>
            <Link
              href="/"
              className="text-sm text-blue-600 hover:text-blue-700 underline"
            >
              Back to generator
            </Link>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleModeChange("function")}
              className={`px-3 py-1.5 text-sm rounded-md border transition-colors ${
                mode === "function"
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
              }`}
              aria-pressed={mode === "function"}
            >
              Find function
            </button>
            <button
              type="button"
              onClick={() => handleModeChange("component")}
              className={`px-3 py-1.5 text-sm rounded-md border transition-colors ${
                mode === "component"
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
              }`}
              aria-pressed={mode === "component"}
            >
              Find component
            </button>
          </div>
        </div>

        {mode === "function" && (
          <>
            <form
              onSubmit={handleSubmit}
              className="w-full bg-white border border-gray-200 rounded-lg p-4 sm:p-6"
            >
              <div className="grid gap-4 md:grid-cols-2">
                <label className="flex flex-col gap-2 text-sm text-gray-600">
                  File path (relative to repo root)
                  <input
                    value={filePath}
                    onChange={(event) => setFilePath(event.target.value)}
                    placeholder="components/generation/VariantCard.tsx"
                    className="px-3 py-2 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </label>
                <label className="flex flex-col gap-2 text-sm text-gray-600">
                  Function name
                  <input
                    value={functionName}
                    onChange={(event) => setFunctionName(event.target.value)}
                    placeholder="handleDownload"
                    className="px-3 py-2 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </label>
              </div>
              <div className="mt-4 flex items-center gap-3">
                <button
                  type="submit"
                  disabled={isFunctionLoading}
                  className="px-4 py-2 rounded-md bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isFunctionLoading ? "Searching..." : "Find function"}
                </button>
                <span className="text-xs text-gray-400">
                  Searches the workspace and calls Cerebras for a summary.
                </span>
              </div>
            </form>

            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  role="alert"
                  className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg"
                >
                  <p className="text-sm text-red-700">{error}</p>
                  {candidates.length > 0 && (
                    <div className="mt-3 text-sm text-red-600">
                      <p className="font-medium">Matching files:</p>
                      <ul className="mt-2 list-disc list-inside space-y-1">
                        {candidates.map((candidate) => (
                          <li key={candidate}>{candidate}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {availableFunctions.length > 0 && (
                    <div className="mt-3 text-sm text-red-600">
                      <p className="font-medium">Functions found in file:</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {availableFunctions.map((name) => (
                          <span
                            key={name}
                            className="px-2 py-1 bg-red-100 rounded text-xs text-red-700"
                          >
                            {name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {result && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="mt-6 space-y-4"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div className="text-sm text-gray-600">
                      <div>
                        <span className="font-medium text-gray-800">File:</span>{" "}
                        {result.filePath}
                      </div>
                      <div>
                        <span className="font-medium text-gray-800">Location:</span>{" "}
                        line {result.startLine}, column {result.startColumn} (
                        {result.matchKind})
                      </div>
                    </div>
                    <div className="text-xs text-gray-400">
                      Matches found: {result.matchCount}
                    </div>
                  </div>

                  {result.summary && (
                    <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                      <p className="text-xs uppercase tracking-wide text-amber-500 mb-2">
                        Cerebras summary
                      </p>
                      <p className="text-sm text-amber-800">{result.summary}</p>
                    </div>
                  )}

                  {result.summaryError && !result.summary && (
                    <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
                      <p className="text-sm text-gray-600">
                        Cerebras summary unavailable: {result.summaryError}
                      </p>
                    </div>
                  )}

                  <div className="border border-gray-200 rounded-lg bg-white">
                    <div className="px-4 py-2 border-b border-gray-200 text-xs uppercase tracking-wide text-gray-400">
                      Function source
                    </div>
                    <pre className="p-4 overflow-x-auto text-sm text-gray-800">
                      <code>{result.functionText}</code>
                    </pre>
                  </div>

                  {result.alternateMatches.length > 0 && (
                    <div className="text-sm text-gray-600">
                      <p className="font-medium text-gray-700">Other matches:</p>
                      <ul className="mt-2 list-disc list-inside space-y-1">
                        {result.alternateMatches.map((match, index) => (
                          <li key={`${match.kind}-${match.startLine}-${index}`}>
                            {match.kind} at line {match.startLine}, column{" "}
                            {match.startColumn}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}

        {mode === "component" && (
          <>
            <div className="w-full bg-white border border-gray-200 rounded-lg p-4 sm:p-6">
              <PromptInput
                onSubmit={handleComponentSubmit}
                isLoading={isComponentLoading}
                placeholder="Describe the component you want to find..."
                label="Describe the component you want to find"
                submitLabel="Find component"
                submitLabelLoading="Finding component"
                submitText="Find"
                submitTextLoading="Finding..."
                submitTextMobile="Find"
                submitTextMobileLoading="..."
              />
              <p className="mt-3 text-xs text-gray-400">
                Uses Cerebras with code search tools (grep, file search, and function extraction).
              </p>
            </div>

            <AnimatePresence>
              {componentError && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  role="alert"
                  className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg"
                >
                  <p className="text-sm text-red-700">{componentError}</p>
                  {componentCandidates.length > 0 && (
                    <div className="mt-3 text-sm text-red-600">
                      <p className="font-medium">Matching files:</p>
                      <ul className="mt-2 list-disc list-inside space-y-1">
                        {componentCandidates.map((candidate) => (
                          <li key={candidate}>{candidate}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {componentAvailableFunctions.length > 0 && (
                    <div className="mt-3 text-sm text-red-600">
                      <p className="font-medium">Functions found in file:</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {componentAvailableFunctions.map((name) => (
                          <span
                            key={name}
                            className="px-2 py-1 bg-red-100 rounded text-xs text-red-700"
                          >
                            {name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {componentResult && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="mt-6 space-y-4"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div className="text-sm text-gray-600">
                      <div>
                        <span className="font-medium text-gray-800">File:</span>{" "}
                        {componentResult.filePath}
                      </div>
                      <div>
                        <span className="font-medium text-gray-800">Component:</span>{" "}
                        {componentResult.componentName}
                      </div>
                      <div>
                        <span className="font-medium text-gray-800">Location:</span>{" "}
                        line {componentResult.startLine}, column{" "}
                        {componentResult.startColumn} ({componentResult.matchKind})
                      </div>
                    </div>
                    <div className="text-xs text-gray-400">
                      Matches found: {componentResult.matchCount}
                    </div>
                  </div>

                  {componentResult.summary && (
                    <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                      <p className="text-xs uppercase tracking-wide text-amber-500 mb-2">
                        Cerebras summary
                      </p>
                      <p className="text-sm text-amber-800">
                        {componentResult.summary}
                      </p>
                    </div>
                  )}

                  <div className="border border-gray-200 rounded-lg bg-white">
                    <div className="px-4 py-2 border-b border-gray-200 text-xs uppercase tracking-wide text-gray-400">
                      Component source
                    </div>
                    <pre className="p-4 overflow-x-auto text-sm text-gray-800">
                      <code>{componentResult.componentText}</code>
                    </pre>
                  </div>

                  <div className="border border-gray-200 rounded-lg bg-white">
                    <div className="px-4 py-2 border-b border-gray-200 text-xs uppercase tracking-wide text-gray-400 flex items-center justify-between">
                      <span>Preview sandbox</span>
                      <button
                        type="button"
                        onClick={() => componentResult && requestPreview(componentResult)}
                        disabled={isPreviewLoading}
                        className="text-xs text-blue-600 hover:text-blue-700 disabled:text-gray-400"
                      >
                        {isPreviewLoading ? "Rendering..." : "Refresh preview"}
                      </button>
                    </div>
                    <div className="p-4">
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
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}
      </div>
    </main>
  );
}
