/** Origin checks protect browser requests; they do not authenticate a caller. */
export function isSameHostOrigin(
  origin: string,
  host: string | undefined,
): boolean {
  try {
    const url = new URL(origin);
    // TODO -- allow http only for localhost development, but not for production.
    return (
      (url.protocol === "http:" || url.protocol === "https:") &&
      url.host === host
    );
  } catch {
    return false;
  }
}
