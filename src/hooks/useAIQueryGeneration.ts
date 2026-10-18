"use client";

import { QUERY_PROGRESS, type QueryProgress } from "../types/queryProtocol";
import { useCallback, useEffect, useRef, useState } from "react";
import { MAX_REQUEST_LENGTH, streamQuery } from "../lib/client/queryStream";
import { appendQueryHistory } from "../lib/shared/queryConversation";
import type { QueryAgentResult, QueryChatMessage } from "../types/query.types";

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
  progress: QueryProgress;
}

const idle: GenerationState = {
  request: "",
  previousTurns: [],
  hasStarted: false,
  isGenerating: false,
  progress: QUERY_PROGRESS.UNDERSTANDING,
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
        onProgress: (progress) => {
          if (active.current === controller)
            setState((previous) => ({ ...previous, progress }));
        },
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

  const cancel = useCallback(() => {
    const controller = active.current;
    if (!controller) return;
    active.current = null;
    controller.abort();
    setState((previous) => ({
      ...previous,
      isGenerating: false,
      error: "Query cancelled.",
    }));
  }, []);

  const reset = useCallback(() => {
    const controller = active.current;
    active.current = null;
    controller?.abort();
    history.current = [];
    setState(idle);
  }, []);

  return { ...state, generateQuery, cancel, reset };
}
