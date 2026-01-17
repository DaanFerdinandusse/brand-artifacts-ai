import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs/promises";
import path from "node:path";

const execFileAsync = promisify(execFile);

const DEFAULT_MAX_RESULTS = 30;
const MAX_RESULTS_CAP = 200;
const DEFAULT_END_LINE = 200;

const CODEBASE_ROOT = process.env.CODEBASE_ROOT ?? process.cwd();

export interface RepoSearchArgs {
  query: string;
  path?: string;
  glob?: string;
  maxResults?: number;
}

export interface RepoSearchMatch {
  file: string;
  line: number;
  text: string;
}

export interface RepoSearchResult {
  matches: RepoSearchMatch[];
}

export interface ReadFileArgs {
  path: string;
  startLine?: number;
  endLine?: number;
}

export interface ReadFileResult {
  path: string;
  startLine: number;
  endLine: number;
  content: string;
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export async function repoSearch(args: RepoSearchArgs): Promise<RepoSearchResult> {
  const query = String(args.query ?? "").trim();
  if (!query) {
    return { matches: [] };
  }

  const relativePath = args.path ?? ".";
  const glob = args.glob ?? "**/*";
  const maxResults = clampNumber(
    Number(args.maxResults) || DEFAULT_MAX_RESULTS,
    1,
    MAX_RESULTS_CAP
  );

  const searchPath = path.resolve(CODEBASE_ROOT, relativePath);
  const rgArgs = ["-n", "--no-heading", "--color", "never", "--glob", glob, query, searchPath];

  try {
    const { stdout } = await execFileAsync("rg", rgArgs, {
      cwd: CODEBASE_ROOT,
      maxBuffer: 10 * 1024 * 1024,
    });

    const matches: RepoSearchMatch[] = [];
    const lines = stdout.split("\n").filter(Boolean);
    for (const line of lines) {
      if (matches.length >= maxResults) {
        break;
      }

      const firstColon = line.indexOf(":");
      const secondColon = line.indexOf(":", firstColon + 1);
      if (firstColon === -1 || secondColon === -1) {
        continue;
      }

      const file = line.slice(0, firstColon);
      const lineNumber = Number(line.slice(firstColon + 1, secondColon));
      const text = line.slice(secondColon + 1);

      if (!Number.isFinite(lineNumber)) {
        continue;
      }

      matches.push({ file, line: lineNumber, text });
    }

    return { matches };
  } catch (error) {
    const exitCode = (error as { code?: number }).code;
    if (exitCode === 1) {
      return { matches: [] };
    }
    throw error;
  }
}

export async function readFile(args: ReadFileArgs): Promise<ReadFileResult> {
  const relativePath = String(args.path ?? "");
  if (!relativePath) {
    throw new Error("read_file requires a path");
  }

  const fullPath = path.resolve(CODEBASE_ROOT, relativePath);
  const raw = await fs.readFile(fullPath, "utf8");
  const lines = raw.split("\n");
  const totalLines = Math.max(1, lines.length);

  const startLine = clampNumber(Number(args.startLine) || 1, 1, totalLines);
  const endLine = clampNumber(
    Number(args.endLine) || DEFAULT_END_LINE,
    startLine,
    totalLines
  );

  const content = lines.slice(startLine - 1, endLine).join("\n");

  return {
    path: relativePath,
    startLine,
    endLine,
    content,
  };
}
