export const MAX_REQUEST_LENGTH = 10_000;
// JSON escapes can expand one UTF-16 code unit to six bytes. Reserve framing
// space so valid Unicode/escaped prompts are not rejected by the socket layer.
export const MAX_HISTORY_LENGTH = 120_000;
export const MAX_HISTORY_MESSAGES = 40;
export const MAX_REQUEST_PAYLOAD_BYTES =
  (MAX_REQUEST_LENGTH + MAX_HISTORY_LENGTH) * 6 + 8_192;
export const AGENT_TIMEOUT_MS = 180_000;
export const MAX_STREAM_TEXT_LENGTH = 1_000_000;
