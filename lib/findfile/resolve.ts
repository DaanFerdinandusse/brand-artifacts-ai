import path from "node:path";
import fs from "node:fs/promises";

const ROOT_DIR = process.cwd();
const IGNORED_DIRS = new Set([
  ".git",
  ".next",
  "node_modules",
  "dist",
  "build",
  "out",
  ".turbo",
]);
const MAX_CANDIDATES = 20;

export interface ResolvedFile {
  absolutePath: string;
  relativePath: string;
}

export interface ResolveResult {
  file?: ResolvedFile;
  candidates?: string[];
  error?: string;
}

function normalizePath(value: string): string {
  return value.replace(/\\/g, "/");
}

function isWithinRoot(resolvedPath: string): boolean {
  const relative = path.relative(ROOT_DIR, resolvedPath);
  return !!relative && !relative.startsWith("..") && !path.isAbsolute(relative);
}

async function isFile(filePath: string): Promise<boolean> {
  try {
    const stat = await fs.stat(filePath);
    return stat.isFile();
  } catch {
    return false;
  }
}

async function walkForCandidates(
  directory: string,
  target: string,
  isPathLike: boolean,
  allowFuzzy: boolean,
  results: string[]
): Promise<void> {
  if (results.length >= MAX_CANDIDATES) {
    return;
  }

  const entries = await fs.readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    if (results.length >= MAX_CANDIDATES) {
      return;
    }

    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (!IGNORED_DIRS.has(entry.name)) {
        await walkForCandidates(entryPath, target, isPathLike, allowFuzzy, results);
      }
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    const relativePath = normalizePath(path.relative(ROOT_DIR, entryPath));
    if (isPathLike) {
      if (relativePath.endsWith(target)) {
        results.push(relativePath);
      }
      continue;
    }

    if (entry.name === target) {
      results.push(relativePath);
      continue;
    }

    if (allowFuzzy && entry.name.toLowerCase().includes(target.toLowerCase())) {
      results.push(relativePath);
    }
  }
}

export async function findFileCandidates(
  inputPath: string,
  limit = MAX_CANDIDATES
): Promise<string[]> {
  const normalizedInput = normalizePath(inputPath.trim());
  const isPathLike = normalizedInput.includes("/");
  const target = isPathLike ? normalizedInput : path.basename(normalizedInput);
  const allowFuzzy = !isPathLike && !target.includes(".");

  const results: string[] = [];
  await walkForCandidates(ROOT_DIR, target, isPathLike, allowFuzzy, results);
  return results.slice(0, limit);
}

export async function resolveUserFilePath(inputPath: string): Promise<ResolveResult> {
  const trimmed = inputPath.trim();
  if (!trimmed) {
    return { error: "File path is required." };
  }

  const candidatePath = path.isAbsolute(trimmed)
    ? path.resolve(trimmed)
    : path.resolve(ROOT_DIR, trimmed);

  if (isWithinRoot(candidatePath) && (await isFile(candidatePath))) {
    return {
      file: {
        absolutePath: candidatePath,
        relativePath: normalizePath(path.relative(ROOT_DIR, candidatePath)),
      },
    };
  }

  const candidates = await findFileCandidates(trimmed);
  if (candidates.length === 1) {
    const absolutePath = path.resolve(ROOT_DIR, candidates[0]);
    return {
      file: {
        absolutePath,
        relativePath: candidates[0],
      },
    };
  }

  if (candidates.length > 1) {
    return {
      candidates,
      error: "Multiple files match that path. Please be more specific.",
    };
  }

  return { error: "File not found in workspace." };
}
