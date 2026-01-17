"use client";

import { useState, useRef, FormEvent } from "react";

interface PromptInputProps {
  onSubmit: (prompt: string) => void;
  isLoading: boolean;
  placeholder?: string;
  label?: string;
  submitLabel?: string;
  submitLabelLoading?: string;
  submitText?: string;
  submitTextLoading?: string;
  submitTextMobile?: string;
  submitTextMobileLoading?: string;
}

export function PromptInput({
  onSubmit,
  isLoading,
  placeholder = "Describe the icon you want to create...",
  label = "Describe the icon you want to create",
  submitLabel = "Generate icons",
  submitLabelLoading = "Generating icons",
  submitText = "Generate",
  submitTextLoading = "Generating...",
  submitTextMobile = "Go",
  submitTextMobileLoading = "...",
}: PromptInputProps) {
  const [prompt, setPrompt] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (prompt.trim() && !isLoading) {
      onSubmit(prompt.trim());
      setPrompt("");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-2xl">
      <label htmlFor="prompt-input" className="sr-only">
        {label}
      </label>
      <div className="relative">
        <textarea
          ref={textareaRef}
          id="prompt-input"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder={placeholder}
          disabled={isLoading}
          rows={3}
          aria-describedby="prompt-hint"
          className="w-full px-3 sm:px-4 py-3 pr-20 sm:pr-28 text-base border border-gray-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-500"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSubmit(e);
            }
          }}
        />
        <span id="prompt-hint" className="sr-only">
          Press Enter to submit, Shift+Enter for new line
        </span>
        <button
          type="submit"
          disabled={!prompt.trim() || isLoading}
          aria-label={isLoading ? submitLabelLoading : submitLabel}
          className="absolute right-2 bottom-2 px-3 sm:px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          <span className="hidden sm:inline">
            {isLoading ? submitTextLoading : submitText}
          </span>
          <span className="sm:hidden">
            {isLoading ? submitTextMobileLoading : submitTextMobile}
          </span>
        </button>
      </div>
    </form>
  );
}
