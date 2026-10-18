import type { QueryAgentResult, QueryChatMessage } from "../types/query.types";
import {
  AGENT_TIMEOUT_MS,
  MAX_STREAM_TEXT_LENGTH,
} from "../types/queryProtocol";
import { isRecord, parseAgentResult } from "./clientValidation";

export { MAX_REQUEST_LENGTH } from "../types/queryProtocol";
// Allow the server's 180s deadline to deliver its final error first.
const STREAM_TIMEOUT_MS = AGENT_TIMEOUT_MS + 5_000;

interface StreamOptions {
  history?: QueryChatMessage[];
  signal: AbortSignal;
  onUpdate: (sql: string, answer: string) => void;
}

/** Own the socket, timer and paint callback together, including connecting/unmount cleanup. */
export function streamQuery(
  request: string,
  { signal, onUpdate, history }: StreamOptions,
): Promise<QueryAgentResult> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(signal.reason);
      return;
    }
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const socket = new WebSocket(
      `${protocol}//${window.location.host}/api/agent/stream`,
    );

    let settled = false;
    let sql = "";
    let answer = "";
    let frame: number | undefined;

    /** Publish accumulated text at most once per scheduled browser paint. */
    function flush() {
      if (frame !== undefined) cancelAnimationFrame(frame);
      frame = undefined;
      if (!signal.aborted) onUpdate(sql, answer);
    }

    /** Settle exactly once and release every resource owned by this stream. */
    function finish(outcome: { result: QueryAgentResult } | { error: Error }) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal.removeEventListener("abort", abort);
      if (frame !== undefined) cancelAnimationFrame(frame);
      frame = undefined;
      socket.onopen = socket.onmessage = socket.onerror = socket.onclose = null;
      socket.close();
      if ("error" in outcome) reject(outcome.error);
      else resolve(outcome.result);
    }

    const abort = () =>
      finish({
        error: new DOMException("Query generation cancelled.", "AbortError"),
      });

    const timer = setTimeout(() => {
      flush();
      finish({ error: new Error("Query generation timed out.") });
    }, STREAM_TIMEOUT_MS);

    signal.addEventListener("abort", abort, { once: true });

    socket.onopen = () => {
      try {
        socket.send(
          JSON.stringify({ request, ...(history?.length ? { history } : {}) }),
        );
      } catch {
        finish({ error: new Error("Could not send the query request.") });
      }
    };

    socket.onmessage = (event: MessageEvent<unknown>) => {
      if (settled) return;
      try {
        if (typeof event.data !== "string")
          throw new Error("Expected a text message.");
        const message: unknown = JSON.parse(event.data);
        if (!isRecord(message)) throw new Error("Expected a stream event.");
        switch (message.type) {
          case "sql_start":
            break;
          case "token":
          case "agent_token":
            if (typeof message.token !== "string")
              throw new Error("Invalid stream token.");
            if (message.type === "token") sql += message.token;
            else answer += message.token;
            if (sql.length + answer.length > MAX_STREAM_TEXT_LENGTH) {
              finish({
                error: new Error(
                  "Query response exceeded the preview size limit.",
                ),
              });
              return;
            }
            frame ??= requestAnimationFrame(flush);
            break;
          case "result": {
            const result = parseAgentResult(message.result);
            // Keep visible tokens/selection intact; use final SQL only if no tokens arrived.
            if (!sql) sql = result.generatedSQL;
            flush();
            finish({ result });
            break;
          }
          case "error":
            if (typeof message.error !== "string")
              throw new Error("Invalid stream error.");
            flush();
            finish({ error: new Error(message.error) });
            break;
          default:
            throw new Error("Unknown stream event.");
        }
      } catch {
        finish({ error: new Error("Invalid response from query agent.") });
      }
    };

    socket.onerror = () => {
      flush();
      finish({ error: new Error("Could not connect to the query agent.") });
    };

    socket.onclose = () => {
      flush();
      finish({ error: new Error("Query stream closed before completion.") });
    };
  });
}
