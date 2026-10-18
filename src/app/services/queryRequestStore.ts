import { randomUUID } from "node:crypto";
import type { QueryRequestContext } from "./queryAgent.types";

const requests = new Map<string, QueryRequestContext>();

/** Assign an internal MCP lookup ID; the caller must dispose it when the agent turn settles. */
export function registerQueryRequest(context: QueryRequestContext) {
  const requestId = randomUUID();
  requests.set(requestId, context);
  return { requestId, dispose: () => requests.delete(requestId) };
}

/** Resolve an active tool context and reject IDs whose owning agent turn has already ended. */
export function getQueryRequest(requestId: string): QueryRequestContext {
  const context = requests.get(requestId);
  if (!context) throw new Error("Query request is no longer active.");
  return context;
}
