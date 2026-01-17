import { IconSpec } from "./schema";
import { serializeSvgForExport } from "./serializeSvg";

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

export function downloadSvg(spec: IconSpec, color: string = "#000000"): void {
  const svgString = serializeSvgForExport(spec, color);
  const blob = new Blob([svgString], { type: "image/svg+xml" });
  downloadBlob(blob, `${spec.name}.svg`);
}

export async function svgToPng(
  spec: IconSpec,
  size: number,
  color: string = "#000000"
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const svgString = serializeSvgForExport(spec, color);
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

    const blob = new Blob([svgString], { type: "image/svg+xml" });
    img.src = URL.createObjectURL(blob);
  });
}

export async function downloadPng(
  spec: IconSpec,
  size: number,
  color: string = "#000000"
): Promise<void> {
  const blob = await svgToPng(spec, size, color);
  downloadBlob(blob, `${spec.name}-${size}px.png`);
}

export async function downloadAllPngs(
  spec: IconSpec,
  sizes: number[],
  color: string = "#000000"
): Promise<void> {
  for (const size of sizes) {
    await downloadPng(spec, size, color);
  }
}

export interface ExportOptions {
  svg: boolean;
  pngSizes: number[];
  color: string;
}

export async function exportIcon(
  spec: IconSpec,
  options: ExportOptions
): Promise<void> {
  if (options.svg) {
    downloadSvg(spec, options.color);
  }

  if (options.pngSizes.length > 0) {
    await downloadAllPngs(spec, options.pngSizes, options.color);
  }
}

export function getSvgDataUrl(spec: IconSpec, color: string = "#000000"): string {
  const svgString = serializeSvgForExport(spec, color);
  const encoded = encodeURIComponent(svgString);
  return `data:image/svg+xml,${encoded}`;
}

export async function getPngDataUrl(
  spec: IconSpec,
  size: number,
  color: string = "#000000"
): Promise<string> {
  const blob = await svgToPng(spec, size, color);
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
