import { EditorState, type Extension } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { basicSetup } from "codemirror";
import { codeEditorTheme } from "./codeEditorTheme";

export function createEditorState({ languageSupport }: { languageSupport: Extension }) {
  return EditorState.create({
    extensions: [
      basicSetup,
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
