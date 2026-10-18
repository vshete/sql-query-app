"use client";

import type { SchemaTable } from "@/app/types/databaseSchema.types";
import { memo, useDeferredValue, useId, useMemo, useState } from "react";
import { WorkspaceIcon } from "../WorkspaceIcon";
import styles from "./queryAgent.module.css";

/** Filter cached tables and columns locally, grouping matches by schema without querying PostgreSQL. */
export default memo(function SchemaExplorer({
  tables,
  error,
  isLoading,
  onRefresh,
  refreshDisabled,
}: {
  tables: SchemaTable[];
  error: string;
  isLoading: boolean;
  onRefresh: () => void;
  refreshDisabled: boolean;
}) {
  const [filter, setFilter] = useState("");
  const search = useDeferredValue(filter.trim().toLowerCase());
  const id = useId();
  const titleId = `${id}-title`;
  const groups = useMemo(() => {
    const schemas = new Map<string, SchemaTable[]>();
    for (const table of tables) {
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
  }, [tables, search]);

  return (
    <aside
      className={styles.schemaExplorer}
      aria-labelledby={titleId}
      aria-busy={isLoading}
    >
      <div className={styles.explorerHeading}>
        <h2 id={titleId}>Schema explorer</h2>
        <button
          type="button"
          className={styles.clearBtn}
          onClick={onRefresh}
          disabled={isLoading || refreshDisabled}
        >
          {isLoading ? "Updating…" : "Refresh"}
        </button>
      </div>
      <label className={styles.explorerFilterLabel} htmlFor={id}>
        Filter tables or columns
      </label>
      <input
        id={id}
        type="search"
        className={styles.explorerFilter}
        placeholder="Filter tables or columns…"
        value={filter}
        onChange={(event) => setFilter(event.target.value)}
      />
      <div className={styles.explorerTree}>
        {!tables.length ? (
          <p className={styles.explorerEmpty} role="status">
            {isLoading
              ? "Loading schema…"
              : error
                ? "Schema unavailable. Use Refresh to retry."
                : "No accessible tables or views."}
          </p>
        ) : !groups.length ? (
          <p className={styles.explorerEmpty} role="status">
            No tables or columns match “{filter}”.
          </p>
        ) : (
          groups.map(([schema, tables]) => (
            <details key={schema} className={styles.schemaGroup} open>
              <summary className={styles.schemaSummary}>
                <span title={schema}>{schema}</span>
                <span className={styles.explorerCount}>{tables.length}</span>
              </summary>
              {tables.map((table) => (
                <details
                  key={`${table.name}:${search}`}
                  className={styles.schemaTable}
                  open={search ? true : undefined}
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
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      <div className={styles.explorerFooter}>
        <span className={styles.connectionStatus} role="status">
          {isLoading ? "Updating schema…" : `${tables.length} tables / views`}
        </span>
      </div>
    </aside>
  );
});
