export interface SvgVariant {
  id: string;
  svg: string;
  index: number;
}

export interface GenerationResult {
  variants: SvgVariant[];
  error?: string;
}
