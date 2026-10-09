'use client';

import { memo, useEffect, useRef } from "react";
import { EditorView } from "@codemirror/view";
import { sql, PostgreSQL } from "@codemirror/lang-sql";
import { createEditorState } from "./codeEditorConfig";
import "./codeEditorTheme.css";

/** SQL output stays selectable and copyable, but cannot be edited by the user. */
export const CodeEditor = memo(function CodeEditor({ code, language }: { code: string; language: "sql" }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);

  useEffect(() => {
    if (!hostRef.current) return;
    const view = new EditorView({
      state: createEditorState({ languageSupport: sql({ dialect: PostgreSQL }) }),
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
      changes: { from: append ? previous.length : 0, to: previous.length,
        insert: append ? code.slice(previous.length) : code },
    });
  }, [code]);

  return <div ref={hostRef} className="ce-editor-mount" aria-label={`Read-only ${language} output`} />;
});
