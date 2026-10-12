"use client";

import { useMemo, useState } from "react";
import type { ConnectionInfo } from "@/app/types/databaseConnection.types";
import { WorkspaceIcon } from "../WorkspaceIcon";
import styles from "./queryAgent.module.css";

export default function SchemaExplorer({
  connection,
  isLoading,
}: {
  connection: ConnectionInfo;
  isLoading: boolean;
}) {
  const [filter, setFilter] = useState("");
  const groups = useMemo(() => {
    const search = filter.trim().toLowerCase();
    const schemas = new Map<string, NonNullable<ConnectionInfo["tables"]>>();
    for (const table of connection.tables ?? []) {
      if (
        search &&
        !`${table.schema}.${table.name}`.toLowerCase().includes(search) &&
        !table.columns.some((column) =>
          column.name.toLowerCase().includes(search),
        )
      )
        continue;
      const tables = schemas.get(table.schema) ?? [];
      tables.push(table);
      schemas.set(table.schema, tables);
    }
    return [...schemas.entries()];
  }, [connection.tables, filter]);

  return (
    <aside
      className={styles.schemaExplorer}
      aria-labelledby="schema-explorer-title"
      aria-busy={isLoading}
    >
      <div className={styles.explorerHeading}>
        <h2 id="schema-explorer-title">Schema explorer</h2>
        <WorkspaceIcon name="database" size={15} />
      </div>
      <label className={styles.explorerFilterLabel} htmlFor="schema-filter">
        Filter tables or columns
      </label>
      <input
        id="schema-filter"
        type="search"
        className={styles.explorerFilter}
        placeholder="Filter tables or columns…"
        value={filter}
        onChange={(event) => setFilter(event.target.value)}
        disabled={!connection.connected}
      />
      <div className={styles.explorerTree}>
        {!connection.connected ? (
          <p className={styles.explorerEmpty} role="status">
            {isLoading
              ? "Loading connection…"
              : "Database unavailable. Retry the connection to explore its schema."}
          </p>
        ) : !connection.tables?.length ? (
          <p className={styles.explorerEmpty}>No accessible tables or views.</p>
        ) : !groups.length ? (
          <p className={styles.explorerEmpty} role="status">
            No tables or columns match “{filter}”.
          </p>
        ) : (
          groups.map(([schema, tables]) => (
            <details key={schema} className={styles.schemaGroup} open>
              <summary className={styles.schemaSummary}>
                <span>{schema}</span>
                <span className={styles.explorerCount}>{tables.length}</span>
              </summary>
              {tables.map((table) => (
                <details
                  key={table.name}
                  className={styles.schemaTable}
                  open={filter.trim() ? true : undefined}
                >
                  <summary className={styles.tableSummary}>
                    <WorkspaceIcon name="table" size={14} />
                    <span title={`${schema}.${table.name}`}>{table.name}</span>
                    <span className={styles.explorerCount}>
                      {table.columns.length}
                    </span>
                  </summary>
                  <ul
                    className={styles.columnList}
                    aria-label={`${schema}.${table.name} columns`}
                  >
                    {table.columns.map((column) => (
                      <li
                        key={column.name}
                        className={styles.columnItem}
                        title={`${column.name}: ${column.type}${column.nullable ? "" : " · NOT NULL"}`}
                      >
                        <span className={styles.columnName}>{column.name}</span>
                        <span className={styles.columnType}>{column.type}</span>
                      </li>
                    ))}
                  </ul>
                </details>
              ))}
            </details>
          ))
        )}
      </div>
      <div className={styles.explorerFooter}>
        <span
          className={`${styles.connectionStatus} ${connection.connected ? styles.connected : ""}`}
        >
          <span className={styles.statusDot} />
          {isLoading
            ? "Updating schema…"
            : connection.connected
              ? `${connection.tables?.length ?? 0} tables / views`
              : "No database connected"}
        </span>
        {connection.connected && (
          <p title={connection.label}>{connection.label}</p>
        )}
      </div>
    </aside>
  );
}
