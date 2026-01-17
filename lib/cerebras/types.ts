export interface GenerationRequest {
  prompt: string;
  variantCount?: number;
  selectedSvg?: string;
  selectedIndex?: number;
}

export interface RegenerateRequest {
  originalPrompt: string;
  rejectedSvgs: string[];
  variantCount?: number;
}

export type GenerateEvent =
  | { type: "started"; variantCount: number }
  | { type: "critique"; critique: string }
  | { type: "variant_complete"; index: number; svg: string }
  | { type: "variant_error"; index: number; error: string; retrying: boolean }
  | { type: "complete"; variants: string[] }
  | { type: "error"; message: string };

// Chat history types
export interface Message {
  id: string;
  prompt: string;
  variants: string[];
  selectedIndex?: number;
  timestamp: Date;
}
