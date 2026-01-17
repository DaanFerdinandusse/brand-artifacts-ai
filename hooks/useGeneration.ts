"use client";

import { useState, useCallback, useRef } from "react";
import type { GenerateEvent, Message } from "@/lib/cerebras/types";

interface GenerationState {
  messages: Message[];
  currentVariants: string[];
  currentPrompt: string;
  selectedIndex: number | null;
  isLoading: boolean;
  isRegenerating: boolean;
  error: string | null;
  hasGenerated: boolean;
  mode: "parallel" | "single";
  lastCritique: string | null;
}

export function useGeneration() {
  const [state, setState] = useState<GenerationState>({
    messages: [],
    currentVariants: [],
    currentPrompt: "",
    selectedIndex: null,
    isLoading: false,
    isRegenerating: false,
    error: null,
    hasGenerated: false,
    mode: "parallel",
    lastCritique: null,
  });

  // Use ref to track current prompt during generation
  const pendingPromptRef = useRef<string>("");
  // Track active AbortController for request cancellation
  const abortControllerRef = useRef<AbortController | null>(null);
  // Debounce rapid submissions
  const lastSubmitTimeRef = useRef<number>(0);
  const MIN_SUBMIT_INTERVAL = 500; // ms between submissions

  const setMode = useCallback((mode: "parallel" | "single") => {
    setState((prev) => ({ ...prev, mode }));
  }, []);

  const generate = useCallback(
    async (prompt: string) => {
      // Validate input
      const trimmedPrompt = prompt.trim();
      if (!trimmedPrompt) {
        setState((prev) => ({
          ...prev,
          error: "Please enter a description for your icon",
        }));
        return;
      }

      // Prevent rapid submissions
      const now = Date.now();
      if (now - lastSubmitTimeRef.current < MIN_SUBMIT_INTERVAL) {
        return;
      }
      lastSubmitTimeRef.current = now;

      // Abort any existing request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();

      const selectionAtSubmit = state.selectedIndex;
      pendingPromptRef.current = trimmedPrompt;

      setState((prev) => ({
        ...prev,
        messages: (() => {
          if (prev.messages.length === 0) {
            return prev.messages;
          }

          const lastIndex = prev.messages.length - 1;
          const lastMessage = prev.messages[lastIndex];
          const selection =
            selectionAtSubmit === null ? undefined : selectionAtSubmit;

          if (lastMessage.selectedIndex === selection) {
            return prev.messages;
          }

          const updated = [...prev.messages];
          updated[lastIndex] = {
            ...lastMessage,
            selectedIndex: selection,
          };
          return updated;
        })(),
        currentVariants: [],
        currentPrompt: trimmedPrompt,
        isLoading: true,
        error: null,
      }));

      try {
        const response = await fetch("/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: trimmedPrompt,
            mode: state.mode,
            selectedSvg:
              selectionAtSubmit !== null
                ? state.currentVariants[selectionAtSubmit]
                : undefined,
          }),
          signal: abortControllerRef.current.signal,
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error("No response body");
        }

        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              try {
                const event: GenerateEvent = JSON.parse(line.slice(6));

                switch (event.type) {
                  case "variant_complete":
                    setState((prev) => {
                      const newVariants = [...prev.currentVariants];
                      newVariants[event.index] = event.svg;
                      return { ...prev, currentVariants: newVariants };
                    });
                    break;

                  case "complete":
                    setState((prev) => {
                      // Move current generation to history
                      const newMessage: Message = {
                        id: crypto.randomUUID(),
                        prompt: pendingPromptRef.current,
                        variants: event.variants,
                        timestamp: new Date(),
                      };

                      return {
                        ...prev,
                        messages: [...prev.messages, newMessage],
                        currentVariants: event.variants,
                        isLoading: false,
                        hasGenerated: true,
                        selectedIndex: null, // Clear selection after new generation
                      };
                    });
                    break;

                  case "error":
                    setState((prev) => ({
                      ...prev,
                      error: event.message,
                      isLoading: false,
                    }));
                    break;
                }
              } catch {
                // Ignore JSON parse errors
              }
            }
          }
        }
      } catch (error) {
        // Don't show error for aborted requests
        if (error instanceof Error && error.name === "AbortError") {
          return;
        }
        setState((prev) => ({
          ...prev,
          error: error instanceof Error ? error.message : "Unknown error occurred",
          isLoading: false,
        }));
      }
    },
    [state.selectedIndex, state.currentVariants, state.mode]
  );

  const selectVariant = useCallback((index: number | null) => {
    setState((prev) => ({
      ...prev,
      selectedIndex: prev.selectedIndex === index ? null : index,
    }));
  }, []);

  const regenerate = useCallback(async () => {
    // Need current prompt and variants to regenerate
    if (state.currentVariants.length === 0 || !state.currentPrompt) {
      return;
    }

    // Prevent rapid submissions
    const now = Date.now();
    if (now - lastSubmitTimeRef.current < MIN_SUBMIT_INTERVAL) {
      return;
    }
    lastSubmitTimeRef.current = now;

    // Abort any existing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    setState((prev) => ({
      ...prev,
      isLoading: true,
      isRegenerating: true,
      error: null,
      lastCritique: null,
    }));

    try {
      const response = await fetch("/api/regenerate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          originalPrompt: state.currentPrompt,
          rejectedSvgs: state.currentVariants,
          mode: state.mode,
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("No response body");
      }

      const decoder = new TextDecoder();
      let buffer = "";

      // Clear variants before new ones come in
      setState((prev) => ({
        ...prev,
        currentVariants: [],
      }));

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const event: GenerateEvent = JSON.parse(line.slice(6));

              switch (event.type) {
                case "critique":
                  setState((prev) => ({
                    ...prev,
                    lastCritique: event.critique,
                  }));
                  break;

                case "variant_complete":
                  setState((prev) => {
                    const newVariants = [...prev.currentVariants];
                    newVariants[event.index] = event.svg;
                    return { ...prev, currentVariants: newVariants };
                  });
                  break;

                case "complete":
                  setState((prev) => {
                    // Add regenerated results to history
                    const newMessage: Message = {
                      id: crypto.randomUUID(),
                      prompt: `(Regenerated) ${prev.currentPrompt}`,
                      variants: event.variants,
                      timestamp: new Date(),
                    };

                    return {
                      ...prev,
                      messages: [...prev.messages, newMessage],
                      currentVariants: event.variants,
                      isLoading: false,
                      isRegenerating: false,
                      selectedIndex: null,
                    };
                  });
                  break;

                case "error":
                  setState((prev) => ({
                    ...prev,
                    error: event.message,
                    isLoading: false,
                    isRegenerating: false,
                  }));
                  break;
              }
            } catch {
              // Ignore JSON parse errors
            }
          }
        }
      }
    } catch (error) {
      // Don't show error for aborted requests
      if (error instanceof Error && error.name === "AbortError") {
        return;
      }
      setState((prev) => ({
        ...prev,
        error: error instanceof Error ? error.message : "Unknown error occurred",
        isLoading: false,
        isRegenerating: false,
      }));
    }
  }, [state.currentVariants, state.currentPrompt, state.mode]);

  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, error: null }));
  }, []);

  return {
    ...state,
    // Alias for backwards compatibility
    variants: state.currentVariants,
    generate,
    regenerate,
    selectVariant,
    clearError,
    setMode,
  };
}
