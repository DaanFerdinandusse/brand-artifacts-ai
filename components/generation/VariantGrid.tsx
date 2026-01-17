"use client";

import { useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { VariantCard } from "./VariantCard";
import { SkeletonCard } from "./SkeletonCard";

interface VariantGridProps {
  variants: string[];
  isLoading: boolean;
  selectedIndex: number | null;
  onSelect: (index: number) => void;
}

export function VariantGrid({
  variants,
  isLoading,
  selectedIndex,
  onSelect,
}: VariantGridProps) {
  const gridRef = useRef<HTMLDivElement>(null);

  // Navigate focus between cards using arrow keys
  // Grid is 2 columns on mobile, 4 on desktop
  const handleNavigate = useCallback((fromIndex: number, direction: "left" | "right" | "up" | "down") => {
    const grid = gridRef.current;
    if (!grid) return;

    // Determine grid columns based on viewport width
    const isMobile = window.innerWidth < 768; // md breakpoint
    const cols = isMobile ? 2 : 4;

    let nextIndex = fromIndex;

    switch (direction) {
      case "left":
        nextIndex = fromIndex > 0 ? fromIndex - 1 : fromIndex;
        break;
      case "right":
        nextIndex = fromIndex < variants.length - 1 ? fromIndex + 1 : fromIndex;
        break;
      case "up":
        nextIndex = fromIndex >= cols ? fromIndex - cols : fromIndex;
        break;
      case "down":
        nextIndex = fromIndex + cols < variants.length ? fromIndex + cols : fromIndex;
        break;
    }

    if (nextIndex !== fromIndex) {
      const cards = grid.querySelectorAll('[role="button"]');
      const nextCard = cards[nextIndex] as HTMLElement;
      nextCard?.focus();
    }
  }, [variants.length]);

  if (isLoading && variants.length === 0) {
    return (
      <div
        role="group"
        aria-label="Loading icon variants"
        className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 w-full max-w-4xl px-2 sm:px-0"
      >
        {[0, 1, 2, 3].map((i) => (
          <SkeletonCard key={i} index={i} />
        ))}
      </div>
    );
  }

  if (variants.length === 0) {
    return null;
  }

  return (
    <motion.div
      ref={gridRef}
      layout
      role="group"
      aria-label={`${variants.length} icon variants. Use arrow keys to navigate, Enter to select, D to download.`}
      className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 w-full max-w-4xl px-2 sm:px-0"
    >
      <AnimatePresence mode="popLayout">
        {variants.map((svg, index) => (
          <VariantCard
            key={`variant-${index}`}
            svg={svg}
            index={index}
            isSelected={selectedIndex === index}
            onSelect={() => onSelect(index)}
            onNavigate={(direction) => handleNavigate(index, direction)}
          />
        ))}
        {/* Show remaining skeletons while loading more */}
        {isLoading &&
          Array(4 - variants.length)
            .fill(0)
            .map((_, i) => (
              <SkeletonCard key={`skeleton-${i}`} index={variants.length + i} />
            ))}
      </AnimatePresence>
    </motion.div>
  );
}
