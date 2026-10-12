"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { QueryAgentResult } from "../types/query.types";

export function useAIQueryGeneration() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [streamedSQL, setStreamedSQL] = useState("");
  const [agentText, setAgentText] = useState("");
  const [hasStarted, setHasStarted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const active = useRef<WebSocket | null>(null);

  useEffect(
    () => () => {
      active.current?.close();
    },
    [],
  );

  const generateQuery = useCallback(
    async (naturalLanguage: string, onSQL?: (sql: string) => void) => {
      if (active.current)
        throw new Error("A query is already being generated.");
      setHasStarted(true);
      setIsGenerating(true);
      setError(null);
      setStreamedSQL("");
      setAgentText("");
      try {
        const result = await new Promise<QueryAgentResult>(
          (resolve, reject) => {
            const protocol =
              window.location.protocol === "https:" ? "wss:" : "ws:";
            const socket = new WebSocket(
              `${protocol}//${window.location.host}/api/agent/stream`,
            );

            active.current = socket;
            let settled = false;
            let sql = "";
            let answer = "";
            let frame: number | undefined;

            function flushTokens() {
              if (frame !== undefined) cancelAnimationFrame(frame);
              frame = undefined;
              setStreamedSQL(sql);
              setAgentText(answer);
              onSQL?.(sql);
            }

            function scheduleTokens() {
              // Preserve every token, but update React at most once per paint.
              frame ??= requestAnimationFrame(flushTokens);
            }

            const timer = setTimeout(
              () => finish(new Error("Query generation timed out.")),
              125_000,
            );

            function finish(err?: Error, result?: QueryAgentResult) {
              if (settled) return;
              settled = true;
              clearTimeout(timer);
              flushTokens();
              socket.close();
              if (err) reject(err);
              else resolve(result!);
            }

            socket.onopen = () =>
              socket.send(JSON.stringify({ request: naturalLanguage }));
            socket.onmessage = (event) => {
              try {
                const message = JSON.parse(event.data);
                if (settled) return;
                if (message.type === "sql_start") {
                  // Request initialization already cleared the buffers. Never
                  // clear a visible stream in response to another start event.
                } else if (
                  message.type === "token" &&
                  typeof message.token === "string"
                ) {
                  sql += message.token;
                  scheduleTokens();
                } else if (
                  message.type === "agent_token" &&
                  typeof message.token === "string"
                ) {
                  answer += message.token;
                  scheduleTokens();
                } else if (message.type === "result") {
                  // Preserve streamed text and selection; normalization must not
                  // replace the document at the end of a successful stream.
                  if (!sql) {
                    sql = message.result.generatedSQL;
                  }
                  finish(undefined, message.result);
                } else if (message.type === "error") {
                  finish(new Error(message.error));
                }
              } catch {
                finish(new Error("Invalid response from query agent."));
              }
            };
            socket.onerror = () =>
              finish(new Error("Could not connect to the query agent."));
            socket.onclose = () =>
              finish(new Error("Query stream closed before completion."));
          },
        );
        return result;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
        throw err;
      } finally {
        active.current = null;
        setIsGenerating(false);
      }
    },
    [],
  );

  const reset = useCallback(() => {
    setHasStarted(false);
    setStreamedSQL("");
    setAgentText("");
    setError(null);
  }, []);
  return {
    reset,
    hasStarted,
    streamedSQL,
    agentText,
    isGenerating,
    error,
    generateQuery,
  };
}
