"use client";

import { useState, FormEvent } from "react";

interface ChatPanelProps {
  onSubmit: (prompt: string) => void;
  disabled?: boolean;
}

const suggestionChips = [
  "A simple home icon",
  "Settings gear icon",
  "User profile avatar",
  "Search magnifying glass",
  "Heart icon",
];

export function ChatPanel({ onSubmit, disabled }: ChatPanelProps) {
  const [prompt, setPrompt] = useState("");

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (prompt.trim() && !disabled) {
      onSubmit(prompt.trim());
      setPrompt("");
    }
  };

  const handleChipClick = (chip: string) => {
    if (!disabled) {
      onSubmit(chip);
    }
  };

  return (
    <div className="flex flex-col gap-4 p-4 border-b border-gray-200 dark:border-gray-700">
      <div>
        <h2 className="text-lg font-semibold mb-2">Describe your icon</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
          Enter a description or select a suggestion below
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Describe the icon you want..."
          disabled={disabled}
          className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={!prompt.trim() || disabled}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Generate
        </button>
      </form>

      <div className="flex flex-wrap gap-2">
        {suggestionChips.map((chip) => (
          <button
            key={chip}
            onClick={() => handleChipClick(chip)}
            disabled={disabled}
            className="px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {chip}
          </button>
        ))}
      </div>
    </div>
  );
}
