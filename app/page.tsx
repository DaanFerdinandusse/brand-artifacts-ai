"use client";

import { motion, AnimatePresence } from "framer-motion";
import { PromptInput } from "@/components/generation/PromptInput";
import { VariantGrid } from "@/components/generation/VariantGrid";
import { VariantCountSelect } from "@/components/generation/VariantCountSelect";
import { RegenerateButton } from "@/components/generation/RegenerateButton";
import { ChatContainer } from "@/components/chat/ChatContainer";
import { useGeneration } from "@/hooks/useGeneration";

export default function Home() {
  const {
    messages,
    variants,
    selectedIndex,
    isLoading,
    isRegenerating,
    error,
    hasGenerated,
    variantCount,
    lastCritique,
    generate,
    regenerate,
    selectVariant,
    clearError,
    setVariantCount,
  } = useGeneration();

  return (
    <main className="min-h-screen flex flex-col overflow-hidden">
      {/* Animated container that transitions from centered to top */}
      <motion.div
        className="flex-1 flex flex-col items-center px-3 sm:px-4"
        initial={false}
        animate={{
          paddingTop: hasGenerated ? "1rem" : "30vh",
        }}
        transition={{
          type: "spring",
          stiffness: 200,
          damping: 30,
        }}
      >
        {/* Title - animates out after first generation */}
        <AnimatePresence>
          {!hasGenerated && (
            <motion.h1
              initial={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className="text-xl sm:text-2xl font-semibold text-gray-800 mb-6 sm:mb-8 text-center"
            >
              SVG Icon Generator
            </motion.h1>
          )}
        </AnimatePresence>

        {/* Prompt Input - always visible */}
        <motion.div
          layout
          className="w-full max-w-2xl"
          transition={{
            type: "spring",
            stiffness: 200,
            damping: 30,
          }}
        >
          <PromptInput
            onSubmit={generate}
            isLoading={isLoading}
            placeholder={
              selectedIndex !== null
                ? `Refining variant #${selectedIndex + 1}: Add more feedback...`
                : "Describe the icon you want to create..."
            }
          />

          {/* Variant Count */}
          <div className="mt-3 flex items-center justify-between">
            <VariantCountSelect
              value={variantCount}
              onChange={setVariantCount}
              disabled={isLoading}
            />
            <span className="text-xs text-gray-400">
              {variantCount} {variantCount === 1 ? "variant" : "variants"}
            </span>
          </div>
        </motion.div>

        {/* Error message with retry button */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              role="alert"
              aria-live="polite"
              className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg max-w-2xl w-full"
            >
              <div className="flex items-start gap-3">
                {/* Error icon */}
                <div className="flex-shrink-0 mt-0.5">
                  <svg
                    viewBox="0 0 24 24"
                    className="w-5 h-5 text-red-500"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                </div>
                <div className="flex-1">
                  <p className="text-red-700 text-sm">{error}</p>
                  <div className="mt-3 flex items-center gap-2">
                    <button
                      onClick={() => {
                        clearError();
                        // Focus the prompt input for easy retry
                        const input = document.querySelector('textarea');
                        input?.focus();
                      }}
                      className="px-3 py-1.5 text-sm font-medium text-red-700 bg-red-100 rounded-md hover:bg-red-200 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500"
                    >
                      Try again
                    </button>
                    <button
                      onClick={clearError}
                      className="px-3 py-1.5 text-sm text-red-600 hover:text-red-700 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 rounded-md"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
                <button
                  onClick={clearError}
                  aria-label="Dismiss error"
                  className="flex-shrink-0 text-red-400 hover:text-red-600 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 rounded"
                >
                  <svg
                    viewBox="0 0 24 24"
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Chat History - scrollable area above current variants */}
        <AnimatePresence>
          {hasGenerated && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3 }}
              className="mt-6 w-full flex justify-center"
            >
              <ChatContainer messages={messages} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Current Variants */}
        <motion.div
          layout
          className="mt-6 w-full flex flex-col items-center"
          transition={{
            type: "spring",
            stiffness: 200,
            damping: 30,
          }}
        >
          {/* Label for current variants with regenerate button */}
          <AnimatePresence>
            {hasGenerated && !isLoading && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="w-full max-w-4xl mb-2 flex items-center justify-between"
              >
                <span className="text-xs text-gray-400 uppercase tracking-wide">
                  {messages.length > 1 ? "Current Variants" : "Generated Variants"}
                </span>
                <RegenerateButton
                  onClick={regenerate}
                  disabled={variants.length === 0}
                  isLoading={isRegenerating}
                />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Critique display during regeneration */}
          <AnimatePresence>
            {isRegenerating && lastCritique && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="w-full max-w-4xl mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg"
              >
                <p className="text-sm text-amber-800">
                  <span className="font-medium">Analyzing rejected icons: </span>
                  {lastCritique}
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          <VariantGrid
            variants={variants}
            requestedCount={variantCount}
            isLoading={isLoading}
            selectedIndex={selectedIndex}
            onSelect={selectVariant}
          />
        </motion.div>

        {/* Selection hint */}
        <AnimatePresence>
          {variants.length > 0 && !isLoading && selectedIndex === null && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="mt-4 text-sm text-gray-500"
            >
              Click a variant to select it for iteration
            </motion.p>
          )}
        </AnimatePresence>

        {/* Selected variant indicator */}
        <AnimatePresence>
          {selectedIndex !== null && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="mt-4 flex items-center gap-2"
            >
              <span className="text-sm text-blue-600 font-medium">
                Variant #{selectedIndex + 1} selected
              </span>
              <button
                onClick={() => selectVariant(null)}
                className="text-xs text-gray-500 hover:text-gray-700 underline transition-colors"
              >
                Clear selection
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Bottom spacing */}
        <div className="h-8" />
      </motion.div>
    </main>
  );
}
