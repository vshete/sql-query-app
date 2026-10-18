import { EditorState, type Extension } from "@codemirror/state";
import {
  EditorView,
  drawSelection,
  highlightSpecialChars,
  lineNumbers,
} from "@codemirror/view";
import { codeEditorTheme } from "./codeEditorTheme";

/** Configure a selectable, read-only SQL document without editing history or edit keymaps. */
export function createEditorState({
  languageSupport,
}: {
  languageSupport: Extension;
}) {
  return EditorState.create({
    extensions: [
      // Read-only output does not need editing history or edit keymaps.
      lineNumbers(),
      highlightSpecialChars(),
      drawSelection(),
      languageSupport,
      codeEditorTheme,
      EditorState.readOnly.of(true),
      EditorView.editable.of(false),
      EditorView.contentAttributes.of({
        "aria-label": "Generated SQL",
        "aria-readonly": "true",
        role: "textbox",
        "aria-multiline": "true",
        tabindex: "0",
      }),
    ],
  });
}
