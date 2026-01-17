"use client";

interface ModeToggleProps {
  mode: "parallel" | "single";
  onChange: (mode: "parallel" | "single") => void;
  disabled?: boolean;
}

export function ModeToggle({ mode, onChange, disabled }: ModeToggleProps) {
  return (
    <div
      role="radiogroup"
      aria-label="Generation mode"
      className="flex items-center gap-0 text-sm"
    >
      <button
        type="button"
        role="radio"
        aria-checked={mode === "parallel"}
        onClick={() => onChange("parallel")}
        disabled={disabled}
        className={`px-2.5 sm:px-3 py-1.5 rounded-l-md border transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 ${
          mode === "parallel"
            ? "bg-blue-500 text-white border-blue-500"
            : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"
        } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
      >
        <span className="hidden sm:inline">Parallel</span>
        <span className="sm:hidden">4x</span>
      </button>
      <button
        type="button"
        role="radio"
        aria-checked={mode === "single"}
        onClick={() => onChange("single")}
        disabled={disabled}
        className={`px-2.5 sm:px-3 py-1.5 rounded-r-md border -ml-px transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 ${
          mode === "single"
            ? "bg-blue-500 text-white border-blue-500"
            : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"
        } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
      >
        <span className="hidden sm:inline">Single</span>
        <span className="sm:hidden">1x</span>
      </button>
    </div>
  );
}
