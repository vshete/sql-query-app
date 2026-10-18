"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { QueryAgentResult, QueryChatMessage } from "../types/query.types";
import { appendQueryHistory } from "../services/queryConversation";
import { MAX_REQUEST_LENGTH, streamQuery } from "../services/queryStream";

export interface QueryTurn {
  request: string;
  streamedSQL: string;
  agentText: string;
  error: string | null;
  result?: QueryAgentResult;
}

interface GenerationState extends QueryTurn {
  previousTurns: QueryTurn[];
  hasStarted: boolean;
  isGenerating: boolean;
}

const idle: GenerationState = {
  request: "",
  previousTurns: [],
  hasStarted: false,
  isGenerating: false,
  streamedSQL: "",
  agentText: "",
  error: null,
};

/** Own conversation snapshots and one cancellable stream; ignore callbacks from superseded requests. */
export function useAIQueryGeneration() {
  const [state, setState] = useState(idle);
  // Model context is bounded separately from the full visible conversation snapshots.
  const history = useRef<QueryChatMessage[]>([]);
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
    setState((previous) => ({
      ...idle,
      request,
      hasStarted: true,
      isGenerating: true,
      previousTurns: previous.hasStarted
        ? [
            ...previous.previousTurns,
            {
              request: previous.request,
              streamedSQL: previous.streamedSQL,
              agentText: previous.agentText,
              error: previous.error,
              result: previous.result,
            },
          ]
        : previous.previousTurns,
    }));
    try {
      const result = await streamQuery(request, {
        history: history.current,
        signal: controller.signal,
        onUpdate: (streamedSQL, agentText) => {
          if (active.current === controller)
            setState((previous) => ({ ...previous, streamedSQL, agentText }));
        },
      });
      // Identity guards stop an older request from updating a reset or replacement conversation.
      if (active.current === controller) {
        history.current = appendQueryHistory(history.current, request, result);
        setState((previous) => ({ ...previous, result }));
      }
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
    history.current = [];
    setState(idle);
  }, []);

  return { ...state, generateQuery, reset };
}
