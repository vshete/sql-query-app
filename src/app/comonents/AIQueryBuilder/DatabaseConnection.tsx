"use client";
import { useEffect, useState } from "react";
import type { ConnectionInfo } from "@/app/types/databaseConnection.types";
export type { ConnectionInfo } from "@/app/types/databaseConnection.types";
import { WorkspaceIcon } from "../WorkspaceIcon";
import styles from "./queryAgent.module.css";

interface Props {
  onChange: (connection: ConnectionInfo) => void;
  disabled: boolean;
  onBusyChange: (busy: boolean) => void;
}

export default function DatabaseConnection({
  onChange,
  disabled,
  onBusyChange,
}: Props) {
  const [connection, setConnection] = useState<ConnectionInfo>({
    connected: false,
  });
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    onBusyChange(busy);
  }, [busy, onBusyChange]);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/database/connection", { signal: controller.signal })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        setConnection(data);
        onChange(data);
      })
      .catch((error) => {
        if (!controller.signal.aborted) setError(error.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setBusy(false);
      });
    return () => controller.abort();
  }, [onChange]);

  async function update(method: "POST" | "DELETE", refresh = false) {
    if (busy || disabled) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/database/connection", {
        method,
        headers: { "Content-Type": "application/json" },
        body: method === "POST" ? JSON.stringify({ refresh }) : undefined,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setConnection(data);
      onChange(data);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Connection failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      className={styles.connectionPanel}
      aria-label="Database connection"
    >
      <div className={styles.connectionHeading}>
        <span className={styles.connectionLabel}>
          <WorkspaceIcon name="database" /> Database connection
        </span>
        <span
          className={`${styles.connectionStatus} ${connection.connected ? styles.connected : ""}`}
          role="status"
        >
          <span className={styles.statusDot} />
          {busy
            ? "Connecting…"
            : connection.connected
              ? "Connected"
              : "Not connected"}
        </span>
      </div>
      <div className={styles.actionBar}>
        <button
          className={styles.generateBtn}
          disabled={busy || disabled}
          onClick={() => void update("POST")}
          type="button"
        >
          {busy
            ? "Connecting…"
            : connection.connected
              ? "Reconnect"
              : "Connect"}
        </button>
        {connection.connected && (
          <>
            <button
              type="button"
              className={styles.clearBtn}
              disabled={busy || disabled}
              onClick={() => void update("POST", true)}
            >
              Refresh schema
            </button>
            <button
              type="button"
              className={styles.dangerBtn}
              disabled={busy || disabled}
              onClick={() => void update("DELETE")}
            >
              Disconnect
            </button>
          </>
        )}
      </div>

      <p className={styles.connectionDescription} role="status">
        {connection.connected
          ? ` ${connection.label ?? "PostgreSQL"} · ${connection.tableCount ?? 0} tables/views available`
          : "Connect to the default database to generate and run queries."}
      </p>
      {error && (
        <div className={styles.error} role="alert">
          {error}
        </div>
      )}
    </section>
  );
}
