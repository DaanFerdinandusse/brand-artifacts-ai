"use client";

import { useRef, KeyboardEvent } from "react";
import { motion } from "framer-motion";
import { SvgRenderer } from "@/components/svg/SvgRenderer";

interface VariantCardProps {
  svg: string;
  index: number;
  isSelected?: boolean;
  onSelect?: () => void;
  onDownload?: () => void;
  onCopy?: () => void;
  onNavigate?: (direction: "left" | "right" | "up" | "down") => void;
}

export function VariantCard({
  svg,
  index,
  isSelected = false,
  onSelect,
  onDownload,
  onCopy,
  onNavigate,
}: VariantCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);

  const handleDownload = (e: React.MouseEvent | React.KeyboardEvent) => {
    e.stopPropagation();
    if (onDownload) {
      onDownload();
    } else {
      const blob = new Blob([svg], { type: "image/svg+xml" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `icon-variant-${index + 1}.svg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  const handleCopy = async (e: React.MouseEvent | React.KeyboardEvent) => {
    e.stopPropagation();
    if (onCopy) {
      onCopy();
      return;
    }

    const blob = new Blob([svg], { type: "image/svg+xml" });

    if (navigator.clipboard?.write && typeof ClipboardItem !== "undefined") {
      try {
        await navigator.clipboard.write([
          new ClipboardItem({ "image/svg+xml": blob }),
        ]);
        return;
      } catch {
        // Fall back to text copy
      }
    }

    try {
      await navigator.clipboard.writeText(svg);
    } catch {
      // Ignore clipboard errors
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    switch (e.key) {
      case "Enter":
      case " ":
        e.preventDefault();
        onSelect?.();
        break;
      case "c":
      case "C":
        e.preventDefault();
        handleCopy(e);
        break;
      case "d":
      case "D":
        e.preventDefault();
        handleDownload(e);
        break;
      case "ArrowLeft":
        e.preventDefault();
        onNavigate?.("left");
        break;
      case "ArrowRight":
        e.preventDefault();
        onNavigate?.("right");
        break;
      case "ArrowUp":
        e.preventDefault();
        onNavigate?.("up");
        break;
      case "ArrowDown":
        e.preventDefault();
        onNavigate?.("down");
        break;
    }
  };

  return (
    <motion.div
      ref={cardRef}
      role="button"
      tabIndex={0}
      aria-label={`Icon variant ${index + 1}${isSelected ? ", selected" : ""}. Press Enter to select, C to copy, D to download.`}
      aria-pressed={isSelected}
      onClick={onSelect}
      onKeyDown={handleKeyDown}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ scale: 1.05, y: -4 }}
      whileTap={{ scale: 0.98 }}
      transition={{
        type: "spring",
        stiffness: 400,
        damping: 25,
      }}
      className={`
        relative group cursor-pointer rounded-lg border-2 p-4 transition-colors duration-200
        focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
        ${
          isSelected
            ? "border-blue-500 bg-blue-50 shadow-lg shadow-blue-100"
            : "border-gray-200 hover:border-gray-300 hover:shadow-lg"
        }
      `}
    >
      <div className="aspect-square flex items-center justify-center bg-white rounded">
        <SvgRenderer
          svg={svg}
          className="w-full h-full [&>svg]:w-full [&>svg]:h-full"
        />
      </div>

      {/* Action bar - hidden by default, shown on hover or selection */}
      <motion.div
        initial={{ opacity: 0, y: 4 }}
        animate={{
          opacity: isSelected ? 1 : 0,
          y: isSelected ? 0 : 4,
        }}
        transition={{ duration: 0.15 }}
        className={`
          absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1
          px-1.5 py-1 rounded-full bg-white/90 backdrop-blur-sm shadow-sm border border-gray-200/50
          group-hover:opacity-100 transition-opacity duration-150
          ${isSelected ? "opacity-100" : "opacity-0"}
        `}
      >
        {/* Copy button */}
        <button
          onClick={handleCopy}
          className="p-1.5 rounded-full text-gray-500 hover:text-gray-700 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 transition-colors"
          title="Copy SVG"
          aria-label={`Copy variant ${index + 1} SVG`}
          tabIndex={-1}
        >
          <svg
            viewBox="0 0 24 24"
            className="w-3.5 h-3.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </svg>
        </button>

        {/* Download button */}
        <button
          onClick={handleDownload}
          className="p-1.5 rounded-full text-gray-500 hover:text-gray-700 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 transition-colors"
          title="Download SVG"
          aria-label={`Download variant ${index + 1} as SVG`}
          tabIndex={-1}
        >
          <svg
            viewBox="0 0 24 24"
            className="w-3.5 h-3.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
        </button>
      </motion.div>

      {/* Selection checkmark badge */}
      {isSelected && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{
            type: "spring",
            stiffness: 500,
            damping: 25,
          }}
          className="absolute top-2 right-2 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center"
        >
          <svg
            viewBox="0 0 24 24"
            className="w-4 h-4 text-white"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </motion.div>
      )}

      {/* Variant number badge */}
      <div className="absolute top-2 left-2 px-2 py-0.5 bg-gray-100 rounded text-xs text-gray-500 font-medium">
        #{index + 1}
      </div>
    </motion.div>
  );
}
