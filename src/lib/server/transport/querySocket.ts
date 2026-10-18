import { WebSocket } from "ws";
import { AGENT_TIMEOUT_MS, MAX_REQUEST_LENGTH } from "../../../types/queryProtocol";
import { getAgentConfig } from "../agent/agentConfig";
import { getDatabase } from "../database/database";
import { runQueryAgent } from "../agent/queryAgent";
import { parseQueryHistory } from "../../shared/queryConversation";

/** Shared by the local server and the Vercel route. */
export function handleQuerySocket(ws: WebSocket) {
  const controller = new AbortController();
  let started = false;
  let completed = false;
  const deadline = setTimeout(() => {
    send({ type: "error", error: "Query generation timed out." });
    controller.abort(
      new DOMException("Query generation timed out.", "TimeoutError"),
    );
    ws.close();
  }, AGENT_TIMEOUT_MS);
  function send(event: unknown) {
    if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(event));
  }
  ws.on("close", (code: number, reason: Buffer) => {
    clearTimeout(deadline);
    if (completed || controller.signal.aborted) return;
    if (started)
      console.warn("Query socket closed before completion:", {
        code,
        reason: reason?.toString(),
      });
    controller.abort(
      new DOMException(
        "Query connection closed before completion.",
        "AbortError",
      ),
    );
  });
  ws.on("error", (error: Error) => {
    clearTimeout(deadline);
    console.error("Query socket error:", error);
    controller.abort(error);
  });
  ws.on("message", async (data) => {
    if (started) return;
    started = true;
    try {
      const payload = JSON.parse(data.toString());
      if (
        typeof payload.request !== "string" ||
        !payload.request.trim() ||
        payload.request.length > MAX_REQUEST_LENGTH
      ) {
        throw new Error("A request of 1–10000 characters is required.");
      }
      const history = parseQueryHistory(payload.history);
      const database = getDatabase();
      const { provider, apiKey, model } = getAgentConfig();
      const result = await runQueryAgent(
        payload.request.trim(),
        provider,
        apiKey,
        model,
        {
          history,
          summarizeResults: true,
          database,
          signal: controller.signal,
          onProgress: (stage) => send({ type: "progress", stage }),
          onSqlStart: () => send({ type: "sql_start" }),
          onToken: (token) => send({ type: "token", token }),
          onAgentToken: (token) => send({ type: "agent_token", token }),
        },
      );
      send({ type: "result", result });
    } catch (error) {
      if (controller.signal.aborted) return;
      send({
        type: "error",
        error: error instanceof Error ? error.message : "Query agent failed.",
      });
    } finally {
      completed = true;
      clearTimeout(deadline);
      ws.close();
    }
  });
}
