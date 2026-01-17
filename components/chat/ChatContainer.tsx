"use client";

import { useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageGroup } from "./MessageGroup";
import type { Message } from "@/lib/cerebras/types";

interface ChatContainerProps {
  messages: Message[];
}

export function ChatContainer({ messages }: ChatContainerProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  if (messages.length === 0) {
    return null;
  }

  // Only show messages except the last one (which is displayed as current variants)
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
          Chat History
        </div>
        <AnimatePresence mode="popLayout">
          {historyMessages.map((message) => (
            <MessageGroup key={message.id} message={message} />
          ))}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
