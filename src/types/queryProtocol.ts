export const MAX_REQUEST_LENGTH = 10_000;
// JSON escapes can expand one UTF-16 code unit to six bytes. Reserve framing
// space so valid Unicode/escaped prompts are not rejected by the socket layer.
export const MAX_HISTORY_LENGTH = 120_000;
export const MAX_HISTORY_MESSAGES = 40;
export const MAX_REQUEST_PAYLOAD_BYTES =
  (MAX_REQUEST_LENGTH + MAX_HISTORY_LENGTH) * 6 + 8_192;
export const AGENT_TIMEOUT_MS = 180_000;
export const MAX_STREAM_TEXT_LENGTH = 1_000_000;

/** Shared wire values for agent progress, used by server producers and client consumers. */
export const QUERY_PROGRESS = {
  UNDERSTANDING: "understanding",
  GENERATING_SQL: "generating_sql",
  FETCHING_DATA: "fetching_data",
  SUMMARIZING: "summarizing",
} as const;

export type QueryProgress =
  (typeof QUERY_PROGRESS)[keyof typeof QUERY_PROGRESS];

export const QUERY_PROGRESS_MESSAGES = {
  [QUERY_PROGRESS.UNDERSTANDING]: "Understanding your query…",
  [QUERY_PROGRESS.GENERATING_SQL]: "Generating SQL…",
  [QUERY_PROGRESS.FETCHING_DATA]: "Fetching data from the database…",
  [QUERY_PROGRESS.SUMMARIZING]: "Summarizing results…",
} satisfies Record<QueryProgress, string>;

export function isQueryProgress(value: unknown): value is QueryProgress {
  return (
    typeof value === "string" && Object.hasOwn(QUERY_PROGRESS_MESSAGES, value)
  );
}
