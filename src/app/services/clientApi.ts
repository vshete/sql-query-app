import { responseError } from "./clientValidation";

/** Keep HTML proxy errors and malformed JSON out of component state. */
export async function readJsonResponse(response: Response): Promise<unknown> {
  let value: unknown;
  try {
    value = await response.json();
  } catch {
    throw new Error(
      response.ok
        ? "The server returned invalid JSON."
        : `Request failed (${response.status}).`,
    );
  }
  return value;
}

/** Fetch uncached JSON and convert non-success responses into a user-readable error. */
export async function fetchJson(
  url: string,
  options?: RequestInit,
): Promise<unknown> {
  const response = await fetch(url, { ...options, cache: "no-store" });
  const value = await readJsonResponse(response);
  if (!response.ok)
    throw new Error(
      responseError(value, `Request failed (${response.status}).`),
    );
  return value;
}
