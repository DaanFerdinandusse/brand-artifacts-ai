"use client";

import { useState, useCallback, useRef } from "react";
import type {
  ComponentSearchMessage,
  ComponentSearchResponse,
} from "@/lib/search/types";

interface SearchState {
  messages: ComponentSearchMessage[];
  currentResult: ComponentSearchResponse | null;
  currentDescription: string;
  isLoading: boolean;
  error: string | null;
  hasSearched: boolean;
}

export function useComponentSearch() {
  const [state, setState] = useState<SearchState>({
    messages: [],
    currentResult: null,
    currentDescription: "",
    isLoading: false,
    error: null,
    hasSearched: false,
  });

  const abortControllerRef = useRef<AbortController | null>(null);
  const lastSubmitTimeRef = useRef<number>(0);
  const MIN_SUBMIT_INTERVAL = 500;

  const search = useCallback(async (description: string) => {
    const trimmed = description.trim();
    if (!trimmed) {
      setState((prev) => ({
        ...prev,
        error: "Please enter a description for the component",
      }));
      return;
    }

    const now = Date.now();
    if (now - lastSubmitTimeRef.current < MIN_SUBMIT_INTERVAL) {
      return;
    }
    lastSubmitTimeRef.current = now;

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    setState((prev) => ({
      ...prev,
      currentDescription: trimmed,
      isLoading: true,
      error: null,
    }));

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: trimmed }),
        signal: abortControllerRef.current.signal,
      });

      const payload = (await response.json()) as ComponentSearchResponse;

      if (!response.ok) {
        throw new Error(
          typeof (payload as { error?: unknown }).error === "string"
            ? (payload as { error: string }).error
            : `HTTP error! status: ${response.status}`
        );
      }

      const message: ComponentSearchMessage = {
        id: crypto.randomUUID(),
        description: trimmed,
        response: payload,
        timestamp: new Date(),
      };

      setState((prev) => ({
        ...prev,
        messages: [...prev.messages, message],
        currentResult: payload,
        isLoading: false,
        hasSearched: true,
      }));
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        return;
      }
      setState((prev) => ({
        ...prev,
        error: error instanceof Error ? error.message : "Unknown error occurred",
        isLoading: false,
      }));
    }
  }, []);

  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, error: null }));
  }, []);

  return {
    ...state,
    search,
    clearError,
  };
}
