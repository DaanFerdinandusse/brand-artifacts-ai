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
  onNavigate?: (direction: "left" | "right" | "up" | "down") => void;
}

export function VariantCard({
  svg,
  index,
  isSelected = false,
  onSelect,
  onDownload,
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

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    switch (e.key) {
      case "Enter":
      case " ":
        e.preventDefault();
        onSelect?.();
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
      aria-label={`Icon variant ${index + 1}${isSelected ? ", selected" : ""}. Press Enter to select, D to download.`}
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

      {/* Download button */}
      <motion.button
        onClick={handleDownload}
        initial={{ opacity: 0, scale: 0.8 }}
        whileHover={{ scale: 1.1 }}
        className="absolute bottom-2 right-2 p-2 bg-white rounded-full shadow-md opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
        title="Download SVG"
        aria-label={`Download variant ${index + 1} as SVG`}
        tabIndex={-1}
      >
        <svg
          viewBox="0 0 24 24"
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
      </motion.button>

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
