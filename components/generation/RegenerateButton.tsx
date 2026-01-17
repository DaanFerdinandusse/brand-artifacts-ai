"use client";

import { motion } from "framer-motion";

interface RegenerateButtonProps {
  onClick: () => void;
  disabled?: boolean;
  isLoading?: boolean;
}

export function RegenerateButton({
  onClick,
  disabled = false,
  isLoading = false,
}: RegenerateButtonProps) {
  return (
    <motion.button
      onClick={onClick}
      disabled={disabled || isLoading}
      whileHover={{ scale: disabled ? 1 : 1.02 }}
      whileTap={{ scale: disabled ? 1 : 0.98 }}
      aria-label={isLoading ? "Regenerating all variants" : "Regenerate all variants"}
      className={`
        flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-lg border text-sm font-medium transition-colors
        focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1
        ${
          disabled || isLoading
            ? "border-gray-200 text-gray-400 cursor-not-allowed"
            : "border-gray-300 text-gray-600 hover:border-gray-400 hover:text-gray-800 hover:bg-gray-50"
        }
      `}
    >
      <motion.svg
        viewBox="0 0 24 24"
        className="w-4 h-4"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        animate={isLoading ? { rotate: 360 } : {}}
        transition={
          isLoading
            ? { repeat: Infinity, duration: 1, ease: "linear" }
            : {}
        }
        aria-hidden="true"
      >
        <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
        <path d="M3 3v5h5" />
        <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
        <path d="M16 16h5v5" />
      </motion.svg>
      <span className="hidden sm:inline">{isLoading ? "Regenerating..." : "Regenerate All"}</span>
      <span className="sm:hidden">{isLoading ? "..." : "Redo"}</span>
    </motion.button>
  );
}
