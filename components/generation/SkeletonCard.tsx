"use client";

import { motion } from "framer-motion";

interface SkeletonCardProps {
  index?: number;
}

export function SkeletonCard({ index = 0 }: SkeletonCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{
        duration: 0.3,
        delay: index * 0.05,
      }}
      className="rounded-lg border-2 border-gray-200 p-4"
    >
      <div className="aspect-square bg-gray-50 rounded flex items-center justify-center relative overflow-hidden">
        {/* Animated shimmer effect */}
        <motion.div
          className="absolute inset-0 bg-gradient-to-r from-transparent via-white/60 to-transparent"
          animate={{
            x: ["-100%", "100%"],
          }}
          transition={{
            duration: 1.5,
            repeat: Infinity,
            ease: "linear",
          }}
        />
        <div className="w-16 h-16 bg-gray-200 rounded" />
      </div>
    </motion.div>
  );
}
