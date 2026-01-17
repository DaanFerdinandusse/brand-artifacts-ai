import { IconDraft } from "./schema";

export const sampleIcons: IconDraft[] = [
  {
    docType: "iconDraft",
    name: "home",
    preset: "outline_rounded",
    size: 24,
    viewBox: "0 0 24 24",
    paths: [
      { d: "M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" },
      { d: "M9 22V12h6v10" },
    ],
    circles: [],
    rects: [],
    lines: [],
    polylines: [],
    exports: { svg: true, png: [64, 128, 256] },
  },
  {
    docType: "iconDraft",
    name: "settings",
    preset: "outline_rounded",
    size: 24,
    viewBox: "0 0 24 24",
    paths: [
      {
        d: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
      },
      {
        d: "M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z",
      },
    ],
    circles: [],
    rects: [],
    lines: [],
    polylines: [],
    exports: { svg: true, png: [64, 128, 256] },
  },
  {
    docType: "iconDraft",
    name: "user",
    preset: "outline_rounded",
    size: 24,
    viewBox: "0 0 24 24",
    paths: [
      { d: "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" },
    ],
    circles: [{ cx: 12, cy: 7, r: 4 }],
    rects: [],
    lines: [],
    polylines: [],
    exports: { svg: true, png: [64, 128, 256] },
  },
  {
    docType: "iconDraft",
    name: "search",
    preset: "outline_rounded",
    size: 24,
    viewBox: "0 0 24 24",
    paths: [],
    circles: [{ cx: 11, cy: 11, r: 8 }],
    rects: [],
    lines: [{ x1: 21, y1: 21, x2: 16.65, y2: 16.65 }],
    polylines: [],
    exports: { svg: true, png: [64, 128, 256] },
  },
  {
    docType: "iconDraft",
    name: "heart",
    preset: "outline_rounded",
    size: 24,
    viewBox: "0 0 24 24",
    paths: [
      {
        d: "M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z",
      },
    ],
    circles: [],
    rects: [],
    lines: [],
    polylines: [],
    exports: { svg: true, png: [64, 128, 256] },
  },
];

export function getSampleIcon(name: string): IconDraft | undefined {
  return sampleIcons.find((icon) => icon.name === name);
}

export function getSampleIconByIndex(index: number): IconDraft {
  return sampleIcons[index % sampleIcons.length];
}
