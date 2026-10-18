"use client";

/** Offer route-render recovery; asynchronous query errors are handled by their owning hooks. */
export default function WorkspaceError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main id="query-workspace" className="workspace-error" role="alert">
      <h1>The workspace could not be displayed.</h1>
      <p>Reload the workspace to reconnect and try again.</p>
      <button type="button" onClick={reset}>
        Try again
      </button>
    </main>
  );
}
