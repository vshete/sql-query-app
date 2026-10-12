import { EditorView } from "@codemirror/view";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags } from "@lezer/highlight";

/**
 * An editor theme built on the CSS custom properties in codeEditorTheme.css.
 *
 * Keeping the colors as CSS custom properties lets the editor inherit the same
 * palette from its mount element, while this module remains the single CodeMirror
 * styling entry point.
 */
export const codeEditorTheme = [
  syntaxHighlighting(
    HighlightStyle.define([
      { tag: tags.keyword, color: "var(--primary)" },
      {
        tag: [tags.string, tags.special(tags.string)],
        color: "var(--success)",
      },
      { tag: [tags.number, tags.bool, tags.name], color: "var(--info)" },
      { tag: tags.comment, color: "var(--text-muted)", fontStyle: "italic" },
      { tag: [tags.operator, tags.punctuation], color: "var(--foreground)" },
    ]),
  ),
  EditorView.theme({
    "&": {
      backgroundColor: "var(--ce-color-surface)",
      border: "none",
      borderRadius: "0",
      color: "var(--ce-color-text)",
      fontFamily: "var(--ce-font-mono)",
      fontSize: "0.875rem",
      lineHeight: "1.5",
      height: "100%",
    },
    "&.cm-focused": {
      boxShadow: "inset 0 0 0 2px var(--ce-color-focus-ring)",
      outline: "none",
    },
    ".cm-scroller": {
      height: "100%",
      minHeight: "0",
      maxHeight: "none",
      overflow: "auto",
    },
    ".cm-content, .cm-gutter": { minHeight: "100%" },
    ".cm-content": { caretColor: "var(--ce-color-text)" },
    ".cm-cursor, .cm-dropCursor": { borderLeftColor: "var(--ce-color-text)" },
    ".cm-gutters": {
      backgroundColor: "var(--ce-color-surface-subtle)",
      borderRight: "1px solid var(--ce-color-border-subtle)",
      color: "var(--ce-color-text-muted)",
    },
    ".cm-activeLine": { backgroundColor: "var(--ce-color-surface-active)" },
    ".cm-activeLineGutter": {
      backgroundColor: "var(--ce-color-surface-active)",
    },
    ".cm-selectionBackground, ::selection": {
      backgroundColor: "var(--ce-color-selection)",
    },
    "&.cm-focused .cm-selectionBackground, &.cm-focused ::selection": {
      backgroundColor: "var(--ce-color-selection)",
    },
    ".cm-matchingBracket": {
      backgroundColor: "var(--ce-color-match)",
      color: "inherit",
      outline: "1px solid var(--ce-color-focus)",
    },
    ".cm-tooltip": {
      backgroundColor: "var(--ce-color-surface)",
      border: "1px solid var(--ce-color-border)",
      borderRadius: "var(--ce-radius-sm)",
      color: "var(--ce-color-text)",
    },
    ".cm-tooltip-autocomplete > ul > li[aria-selected]": {
      backgroundColor: "var(--ce-color-selection)",
      color: "var(--ce-color-text)",
    },
  }),
];
