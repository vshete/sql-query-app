"use client";
import { fetchJson } from "@/app/services/clientApi";
import { parseConnectionInfo } from "@/app/services/clientValidation";
import type { ConnectionInfo } from "@/app/types/databaseConnection.types";
import { useEffect, useRef, useState } from "react";
import { WorkspaceIcon } from "../WorkspaceIcon";
import styles from "./queryAgent.module.css";
export type { ConnectionInfo } from "@/app/types/databaseConnection.types";

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

  const active = useRef<AbortController | null>(null);
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    onBusyChange(busy);
  }, [busy, onBusyChange]);

  useEffect(() => {
    const controller = new AbortController();
    active.current = controller;
    fetchJson("/api/database/connection", {
      signal: AbortSignal.any([controller.signal, AbortSignal.timeout(30_000)]),
    })
      .then((value) => {
        const connection = parseConnectionInfo(value);
        if (!controller.signal.aborted) {
          setConnection(connection);
          onChangeRef.current(connection);
        }
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted)
          setError(
            error instanceof Error ? error.message : "Connection failed.",
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          active.current = null;
          setBusy(false);
        }
      });
    return () => {
      active.current?.abort();
      active.current = null;
    };
  }, []);

  async function update(method: "POST" | "DELETE", refresh = false) {
    if (active.current || disabled) return;
    const controller = new AbortController();
    active.current = controller;
    setBusy(true);
    setError("");
    try {
      const value = await fetchJson("/api/database/connection", {
        method,
        headers: { "Content-Type": "application/json" },
        body: method === "POST" ? JSON.stringify({ refresh }) : undefined,
        signal: AbortSignal.any([
          controller.signal,
          AbortSignal.timeout(30_000),
        ]),
      });
      const connection = parseConnectionInfo(value);
      if (!controller.signal.aborted) {
        setConnection(connection);
        onChangeRef.current(connection);
      }
    } catch (error: unknown) {
      if (!controller.signal.aborted)
        setError(error instanceof Error ? error.message : "Connection failed.");
    } finally {
      if (!controller.signal.aborted) {
        active.current = null;
        setBusy(false);
      }
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
