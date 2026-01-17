import { IconCompileResult } from "./schema";

export function replaceCurrentColor(svg: string, color: string): string {
  if (color === "currentColor") {
    return svg;
  }
  return svg.replace(/currentColor/g, color);
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function downloadSvg(svg: string, filename: string): void {
  const blob = new Blob([svg], { type: "image/svg+xml" });
  downloadBlob(blob, filename);
}

export async function svgToPng(svg: string, size: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    if (!ctx) {
      reject(new Error("Failed to get canvas context"));
      return;
    }

    canvas.width = size;
    canvas.height = size;

    img.onload = () => {
      ctx.drawImage(img, 0, 0, size, size);
      canvas.toBlob((blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error("Failed to create PNG blob"));
        }
      }, "image/png");
    };

    img.onerror = () => {
      reject(new Error("Failed to load SVG image"));
    };

    const blob = new Blob([svg], { type: "image/svg+xml" });
    img.src = URL.createObjectURL(blob);
  });
}

export async function downloadPng(
  svg: string,
  size: number,
  filename: string
): Promise<void> {
  const blob = await svgToPng(svg, size);
  downloadBlob(blob, filename);
}

export function downloadCompiledSvg(
  compiled: IconCompileResult,
  name: string,
  color: string = "#000000"
): void {
  if (!compiled.ok) {
    return;
  }
  const svg = replaceCurrentColor(compiled.svg, color);
  downloadSvg(svg, `${name}.svg`);
}

export async function downloadCompiledPng(
  compiled: IconCompileResult,
  name: string,
  size: number,
  color: string = "#000000"
): Promise<void> {
  if (!compiled.ok) {
    return;
  }
  const svg = replaceCurrentColor(compiled.svg, color);
  await downloadPng(svg, size, `${name}-${size}px.png`);
}

export interface ExportOptions {
  svg: boolean;
  pngSizes: number[];
  color: string;
}

export async function exportCompiledIcon(
  compiled: IconCompileResult,
  name: string,
  options: ExportOptions
): Promise<void> {
  if (!compiled.ok) {
    return;
  }

  if (options.svg) {
    downloadCompiledSvg(compiled, name, options.color);
  }

  if (options.pngSizes.length > 0) {
    for (const size of options.pngSizes) {
      await downloadCompiledPng(compiled, name, size, options.color);
    }
  }
}

export function getSvgDataUrl(svg: string): string {
  const encoded = encodeURIComponent(svg);
  return `data:image/svg+xml,${encoded}`;
}

export async function getPngDataUrl(
  svg: string,
  size: number
): Promise<string> {
  const blob = await svgToPng(svg, size);
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
      } else {
        reject(new Error("Failed to read blob as data URL"));
      }
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
