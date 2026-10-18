"use client";

import { useState } from "react";
import { useDatabaseSchema } from "@/hooks/useDatabaseSchema";
import NaturalLanguageInput from "./NaturalLanguageInput";
import SchemaExplorer from "./SchemaExplorer";
import styles from "./queryAgent.module.css";

/** Connect schema refresh and generation state without coupling their data-fetching lifecycles. */
export default function QueryWorkspace() {
  const { tables, isLoading, error, refreshSchema } = useDatabaseSchema();
  const [isGenerating, setIsGenerating] = useState(false);

  return (
    <div className={styles.workspaceLayout}>
      <SchemaExplorer
        tables={tables}
        isLoading={isLoading}
        error={error}
        onRefresh={refreshSchema}
        refreshDisabled={isGenerating}
      />
      <NaturalLanguageInput onGeneratingChange={setIsGenerating} />
    </div>
  );
}
