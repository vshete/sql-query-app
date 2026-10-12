import { WebSocket } from "ws";
import { AGENT_TIMEOUT_MS, MAX_REQUEST_LENGTH } from "../types/queryProtocol";
import { getAgentConfig } from "./agentConfig";
import { getDatabase } from "./database";
import { runQueryAgent } from "./queryAgent";
import { parseQueryHistory } from "./queryConversation";

/** Shared by the local server and the Vercel route. */
export function handleQuerySocket(ws: WebSocket) {
  const controller = new AbortController();
  let started = false;
  const deadline = setTimeout(() => {
    send({ type: "error", error: "Query generation timed out." });
    controller.abort();
    ws.close();
  }, AGENT_TIMEOUT_MS);
  function send(event: unknown) {
    if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(event));
  }
  ws.on("close", () => {
    clearTimeout(deadline);
    controller.abort();
  });
  ws.on("error", () => controller.abort());
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
          onSqlStart: () => send({ type: "sql_start" }),
          onToken: (token) => send({ type: "token", token }),
          onAgentToken: (token) => send({ type: "agent_token", token }),
        },
      );
      send({ type: "result", result });
    } catch (error) {
      send({
        type: "error",
        error: error instanceof Error ? error.message : "Query agent failed.",
      });
    } finally {
      clearTimeout(deadline);
      ws.close();
    }
  });
}
