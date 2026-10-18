"use client";

import { memo, useEffect, useId, useRef, useState } from "react";
import { EditorView } from "@codemirror/view";
import { sql, PostgreSQL } from "@codemirror/lang-sql";
import { createEditorState } from "./codeEditorConfig";
import "./codeEditorTheme.css";

/** SQL output stays selectable and copyable, but cannot be edited by the user. */
export const CodeEditor = memo(function CodeEditor({ code }: { code: string }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const [expanded, setExpanded] = useState(false);
  const editorId = useId();
  const hasMoreLines = code.split("\n", 6).length > 5;

  useEffect(() => {
    if (!code) setExpanded(false);
  }, [code]);

  useEffect(() => {
    viewRef.current?.requestMeasure();
  }, [expanded]);

  useEffect(() => {
    if (!hostRef.current) return;
    const view = new EditorView({
      state: createEditorState({
        languageSupport: sql({ dialect: PostgreSQL }),
      }),
      parent: hostRef.current,
    });
    viewRef.current = view;
    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, []);

  useEffect(() => {
    const view = viewRef.current;
    if (!view || code === view.state.doc.toString()) return;
    const previous = view.state.doc.toString();
    // Append streaming tokens without replacing the existing document.
    const append = code.startsWith(previous);
    view.dispatch({
      changes: {
        from: append ? previous.length : 0,
        to: previous.length,
        insert: append ? code.slice(previous.length) : code,
      },
    });
  }, [code]);

  return (
    <div className="ce-editor-preview">
      <div
        ref={hostRef}
        id={editorId}
        className={`ce-editor-mount${expanded && hasMoreLines ? " ce-editor-expanded" : ""}`}
        aria-label="Read-only SQL output"
      />
      {hasMoreLines && (
        <button
          type="button"
          className="ce-editor-toggle"
          aria-expanded={expanded}
          aria-controls={editorId}
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded ? "Show less" : "Show more"}
        </button>
      )}
    </div>
  );
});
