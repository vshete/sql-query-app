import { randomUUID } from "node:crypto";
import type { QueryRequestContext } from "./queryAgent.types";

const requests = new Map<string, QueryRequestContext>();

export function registerQueryRequest(context: QueryRequestContext) {
  const requestId = randomUUID();
  requests.set(requestId, context);
  return { requestId, dispose: () => requests.delete(requestId) };
}

export function getQueryRequest(requestId: string): QueryRequestContext {
  const context = requests.get(requestId);
  if (!context) throw new Error("Query request is no longer active.");
  return context;
}
