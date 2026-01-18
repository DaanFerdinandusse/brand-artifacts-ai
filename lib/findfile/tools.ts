import fs from "node:fs/promises";
import { resolveUserFilePath, type ResolveResult } from "@/lib/findfile/resolve";
import { findFunctionMatches, listFunctionNames } from "@/lib/findfile/functions";

const MAX_LINES = 400;

export interface FileReadResult {
  filePath?: string;
  content?: string;
  startLine?: number;
  endLine?: number;
  totalLines?: number;
  error?: string;
  candidates?: string[];
}

export interface FunctionListResult {
  filePath?: string;
  functions?: string[];
  error?: string;
  candidates?: string[];
}

export interface FunctionFindResult {
  filePath?: string;
  matches?: Array<{
    kind: string;
    startLine: number;
    startColumn: number;
    text: string;
  }>;
  availableFunctions?: string[];
  error?: string;
  candidates?: string[];
}

function failureFromResolve(result: ResolveResult): {
  error: string;
  candidates?: string[];
} {
  return {
    error: result.error ?? "Unable to resolve file path.",
    candidates: result.candidates,
  };
}

export async function readFileSegment(
  filePath: string,
  startLine?: number,
  endLine?: number
): Promise<FileReadResult> {
  const resolved = await resolveUserFilePath(filePath);
  if (!resolved.file) {
    return failureFromResolve(resolved);
  }

  const sourceText = await fs.readFile(resolved.file.absolutePath, "utf8");
  const lines = sourceText.split(/\r?\n/);
  const totalLines = lines.length;
  const safeStart = Math.max(1, startLine ?? 1);
  const safeEnd = Math.min(endLine ?? safeStart + MAX_LINES - 1, totalLines);
  const limitedEnd =
    safeEnd - safeStart + 1 > MAX_LINES ? safeStart + MAX_LINES - 1 : safeEnd;

  return {
    filePath: resolved.file.relativePath,
    content: lines.slice(safeStart - 1, limitedEnd).join("\n"),
    startLine: safeStart,
    endLine: limitedEnd,
    totalLines,
  };
}

export async function listFunctionsInFile(
  filePath: string
): Promise<FunctionListResult> {
  const resolved = await resolveUserFilePath(filePath);
  if (!resolved.file) {
    return failureFromResolve(resolved);
  }

  const sourceText = await fs.readFile(resolved.file.absolutePath, "utf8");
  const functions = listFunctionNames(sourceText, resolved.file.absolutePath);
  return {
    filePath: resolved.file.relativePath,
    functions,
  };
}

export async function findFunctionInFile(
  filePath: string,
  functionName: string
): Promise<FunctionFindResult> {
  const resolved = await resolveUserFilePath(filePath);
  if (!resolved.file) {
    return failureFromResolve(resolved);
  }

  const sourceText = await fs.readFile(resolved.file.absolutePath, "utf8");
  const matches = findFunctionMatches(
    sourceText,
    resolved.file.absolutePath,
    functionName
  );

  if (matches.length === 0) {
    return {
      filePath: resolved.file.relativePath,
      availableFunctions: listFunctionNames(sourceText, resolved.file.absolutePath),
      error: `Function "${functionName}" not found.`,
    };
  }

  return {
    filePath: resolved.file.relativePath,
    matches: matches.map((match) => ({
      kind: match.kind,
      startLine: match.startLine,
      startColumn: match.startColumn,
      text: match.text,
    })),
  };
}
