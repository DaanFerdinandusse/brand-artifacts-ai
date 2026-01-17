"use client";

import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { ComponentSearchMessage } from "@/lib/search/types";
import { SearchMessageGroup } from "./SearchMessageGroup";

interface SearchHistoryProps {
  messages: ComponentSearchMessage[];
}

export function SearchHistory({ messages }: SearchHistoryProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  if (messages.length === 0) {
    return null;
  }

  const historyMessages = messages.slice(0, -1);

  if (historyMessages.length === 0) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.3 }}
      className="w-full max-w-4xl mb-6"
    >
      <div
        ref={scrollRef}
        className="max-h-[40vh] overflow-y-auto border border-gray-200 rounded-lg p-4 bg-gray-50"
      >
        <div className="text-xs text-gray-400 uppercase tracking-wide mb-4">
          Search History
        </div>
        <AnimatePresence mode="popLayout">
          {historyMessages.map((message) => (
            <SearchMessageGroup key={message.id} message={message} />
          ))}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
