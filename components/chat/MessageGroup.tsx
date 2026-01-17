"use client";

import { motion } from "framer-motion";
import { SvgRenderer } from "@/components/svg/SvgRenderer";
import type { Message } from "@/lib/cerebras/types";

interface MessageGroupProps {
  message: Message;
}

export function MessageGroup({ message }: MessageGroupProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="mb-6"
    >
      {/* User prompt */}
      <div className="mb-3">
        <span className="text-sm text-gray-500">You:</span>
        <p className="text-gray-800 mt-1">
          &quot;{message.prompt}&quot;
          {message.selectedIndex !== undefined && (
            <span className="text-blue-600 text-sm ml-2">
              (selected #{message.selectedIndex + 1})
            </span>
          )}
        </p>
      </div>

      {/* Variants grid - smaller in history */}
      <div className="grid grid-cols-4 gap-2">
        {message.variants.map((svg, index) => (
          <div
            key={index}
            className={`
              relative rounded-lg border p-2 bg-white
              ${
                message.selectedIndex === index
                  ? "border-blue-400 ring-1 ring-blue-200"
                  : "border-gray-200"
              }
            `}
          >
            <div className="aspect-square flex items-center justify-center">
              <SvgRenderer
                svg={svg}
                className="w-full h-full [&>svg]:w-full [&>svg]:h-full"
              />
            </div>
            {message.selectedIndex === index && (
              <div className="absolute top-1 right-1 w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
                <svg
                  viewBox="0 0 24 24"
                  className="w-3 h-3 text-white"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
            )}
          </div>
        ))}
      </div>
    </motion.div>
  );
}
