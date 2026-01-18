import { NextRequest } from "next/server";
import fs from "node:fs/promises";
import { generateCompletion } from "@/lib/cerebras/client";
import { resolveUserFilePath } from "@/lib/findfile/resolve";
import { findFunctionMatches, listFunctionNames } from "@/lib/findfile/functions";

export const runtime = "nodejs";

interface FindFileRequest {
  filePath: string;
  functionName: string;
}

export async function POST(req: NextRequest) {
  let body: FindFileRequest;
  try {
    body = (await req.json()) as FindFileRequest;
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON payload." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const filePath = body.filePath?.trim();
  const functionName = body.functionName?.trim();

  if (!filePath || !functionName) {
    return new Response(
      JSON.stringify({ error: "filePath and functionName are required." }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const resolved = await resolveUserFilePath(filePath);
  if (!resolved.file) {
    const status = resolved.candidates ? 409 : 404;
    return new Response(
      JSON.stringify({
        error: resolved.error ?? "Unable to resolve file path.",
        candidates: resolved.candidates ?? [],
      }),
      { status, headers: { "Content-Type": "application/json" } }
    );
  }

  const { absolutePath, relativePath } = resolved.file;
  const sourceText = await fs.readFile(absolutePath, "utf8");
  const matches = findFunctionMatches(sourceText, absolutePath, functionName);

  if (matches.length === 0) {
    const availableFunctions = listFunctionNames(sourceText, absolutePath);
    return new Response(
      JSON.stringify({
        error: `Function "${functionName}" not found in ${relativePath}.`,
        availableFunctions,
      }),
      { status: 404, headers: { "Content-Type": "application/json" } }
    );
  }

  const match = matches[0];
  let summary: string | null = null;
  let summaryError: string | null = null;

  try {
    summary = await generateCompletion(
      [
        {
          role: "system",
          content:
            "You summarize code. Respond with 1-2 short sentences describing what the function does.",
        },
        {
          role: "user",
          content: `File: ${relativePath}\nFunction name: ${functionName}\n\n${match.text}`,
        },
      ],
      { temperature: 0.2, maxTokens: 200 }
    );
  } catch (error) {
    summaryError = error instanceof Error ? error.message : "Cerebras request failed.";
  }

  return new Response(
    JSON.stringify({
      filePath: relativePath,
      functionName,
      matchCount: matches.length,
      matchKind: match.kind,
      startLine: match.startLine,
      startColumn: match.startColumn,
      functionText: match.text,
      summary,
      summaryError,
      alternateMatches: matches.slice(1).map((item) => ({
        kind: item.kind,
        startLine: item.startLine,
        startColumn: item.startColumn,
      })),
    }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
}
