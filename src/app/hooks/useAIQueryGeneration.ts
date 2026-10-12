"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { QueryAgentResult } from "../types/query.types";
import { MAX_REQUEST_LENGTH, streamQuery } from "../services/queryStream";

interface GenerationState {
  hasStarted: boolean;
  isGenerating: boolean;
  streamedSQL: string;
  agentText: string;
  error: string | null;
  result?: QueryAgentResult;
}

const idle: GenerationState = {
  hasStarted: false,
  isGenerating: false,
  streamedSQL: "",
  agentText: "",
  error: null,
};

export function useAIQueryGeneration() {
  const [state, setState] = useState(idle);
  const active = useRef<AbortController | null>(null);

  useEffect(
    () => () => {
      const controller = active.current;
      active.current = null;
      controller?.abort();
    },
    [],
  );

  const generateQuery = useCallback(async (naturalLanguage: string) => {
    const request = naturalLanguage.trim();
    if (!request || request.length > MAX_REQUEST_LENGTH)
      throw new Error(`Enter a request of 1–${MAX_REQUEST_LENGTH} characters.`);
    if (active.current) throw new Error("A query is already being generated.");
    const controller = new AbortController();
    active.current = controller;
    setState({ ...idle, hasStarted: true, isGenerating: true });
    try {
      const result = await streamQuery(request, {
        signal: controller.signal,
        onUpdate: (streamedSQL, agentText) => {
          if (active.current === controller)
            setState((previous) => ({ ...previous, streamedSQL, agentText }));
        },
      });
      if (active.current === controller)
        setState((previous) => ({ ...previous, result }));
      return result;
    } catch (error: unknown) {
      if (active.current === controller)
        setState((previous) => ({
          ...previous,
          error:
            error instanceof Error ? error.message : "Query generation failed.",
        }));
      throw error;
    } finally {
      if (active.current === controller) {
        active.current = null;
        setState((previous) => ({ ...previous, isGenerating: false }));
      }
    }
  }, []);

  const reset = useCallback(() => {
    const controller = active.current;
    active.current = null;
    controller?.abort();
    setState(idle);
  }, []);

  return { ...state, generateQuery, reset };
}
