export type SearchConfidence = "low" | "medium" | "high";

export type ToolTraceEntry =
  | {
      tool: "repo_search";
      args: Record<string, unknown>;
      resultCount: number;
    }
  | {
      tool: "read_file";
      args: Record<string, unknown>;
    };

export interface ComponentSearchResponse {
  foundFilePath: string | null;
  componentName?: string | null;
  componentStartLine?: number | null;
  componentEndLine?: number | null;
  componentCode: string | null;
  confidence: SearchConfidence;
  reasoningSummary?: string;
  suggestedNextQueries?: string[];
  toolTrace?: ToolTraceEntry[];
}

export interface ComponentSearchMessage {
  id: string;
  description: string;
  response: ComponentSearchResponse;
  timestamp: Date;
}
