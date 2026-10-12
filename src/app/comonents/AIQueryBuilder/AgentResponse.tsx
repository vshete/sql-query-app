"use client";

import { memo, useDeferredValue } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { WorkspaceIcon } from "../WorkspaceIcon";
import styles from "./queryAgent.module.css";

const plugins = [remarkGfm];
const components: Components = { img: ({ alt }) => <span>{alt ?? ""}</span> };

const Markdown = memo(function Markdown({ text }: { text: string }) {
  return (
    <ReactMarkdown remarkPlugins={plugins} components={components}>
      {text}
    </ReactMarkdown>
  );
});

export default memo(function AgentResponse({ text }: { text: string }) {
  const deferredText = useDeferredValue(text);
  return (
    <section className={styles.responsePanel} aria-label="Agent response">
      <div className={styles.editorHeading}>
        <WorkspaceIcon name="sparkles" />
        <strong>Query response</strong>
      </div>
      <div className={styles.markdown}>
        <Markdown text={deferredText} />
      </div>
    </section>
  );
});
