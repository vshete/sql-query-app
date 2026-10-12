"use client";

import { useCallback, useState } from "react";
import { useDefaultDatabaseConnection } from "@/app/hooks/useDefaultDatabaseConnection";
import NaturalLanguageInput from "./NaturalLanguageInput";
import SchemaExplorer from "./SchemaExplorer";
import styles from "./queryAgent.module.css";

export default function QueryWorkspace() {
  const databaseConnection = useDefaultDatabaseConnection();
  const { connection, isConnecting, retryConnection } = databaseConnection;
  const [isGenerating, setIsGenerating] = useState(false);
  const refreshConnection = useCallback(
    () => retryConnection(true),
    [retryConnection],
  );

  return (
    <div className={styles.workspaceLayout}>
      <SchemaExplorer
        key={connection.label ?? "disconnected"}
        connection={connection}
        isLoading={isConnecting}
        onRefresh={refreshConnection}
        refreshDisabled={isGenerating}
      />
      <NaturalLanguageInput
        databaseConnection={databaseConnection}
        onGeneratingChange={setIsGenerating}
      />
    </div>
  );
}
