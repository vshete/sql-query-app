import pg from "pg";
import { QueryTypes, Sequelize } from "sequelize";
import type { DatabaseQueryResult, QueryValue } from "../types/query.types";
import { cleanAndValidateSql } from "./sqlValidation";

const state = globalThis as typeof globalThis & {
  queryAppDatabases?: Map<string, Sequelize>;
};
const databases = (state.queryAppDatabases ??= new Map<string, Sequelize>());
const MAX_ROWS = 1000;

/** Reuse a server-owned PostgreSQL pool by connection URL, including across development reloads. */
export function getDatabase(
  connectionString = process.env.DATABASE_URL,
): Sequelize {
  if (!connectionString) {
    throw new Error(
      "Set DATABASE_URL in your .env file to connect to PostgreSQL.",
    );
  }
  let database = databases.get(connectionString);
  if (!database) {
    database = new Sequelize(connectionString, {
      dialect: "postgres",
      // Keep the driver visible to deployment bundlers instead of relying on
      // Sequelize's dynamic require(moduleName).
      dialectModule: pg,
      logging: false,
      pool: { max: 10, min: 0, acquire: 5000, idle: 30000 },
      dialectOptions: {
        connectionTimeoutMillis: 5000,
        statement_timeout: 10000,
      },
    });
    databases.set(connectionString, database);
  }
  return database;
}

/** Preserve PostgreSQL scalars; encode dates and compound values for the JSON result contract. */
function serializeQueryValue(value: unknown): QueryValue {
  if (value instanceof Date) return value.toISOString();
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }
  return JSON.stringify(value) ?? null;
}

/** Validate SQL, fetch a bounded cursor in a read-only transaction, and serialize the loaded rows. */
export async function executeDatabaseQuery(
  sql: string,
  signal?: AbortSignal,
  database = getDatabase(),
): Promise<DatabaseQueryResult> {
  const validated = cleanAndValidateSql(sql, null);
  signal?.throwIfAborted();
  return database.transaction(async (transaction) => {
    signal?.throwIfAborted();
    const options = { transaction, type: QueryTypes.RAW };
    await database.query("SET TRANSACTION READ ONLY", options);
    await database.query(
      "SET LOCAL search_path TO public, pg_catalog",
      options,
    );
    await database.query("SET LOCAL statement_timeout = '10s'", options);
    await database.query("SET LOCAL lock_timeout = '3s'", options);
    // A server-side cursor caps memory use while preserving the original SQL.
    await database.query(
      `DECLARE query_result NO SCROLL CURSOR FOR ${validated.sql}`,
      options,
    );
    const [resultRows, rawMetadata] = await database.query(
      `FETCH FORWARD ${MAX_ROWS + 1} FROM query_result`,
      options,
    );
    // PostgreSQL RAW metadata retains fields even when the cursor returns no rows.
    const metadata = rawMetadata as { fields: { name: string }[] };
    signal?.throwIfAborted();
    const truncated = resultRows.length > MAX_ROWS;
    // Serialize dates, arrays and JSON consistently with the API response.
    const rows = (resultRows as Record<string, unknown>[])
      .slice(0, MAX_ROWS)
      .map((row) =>
        Object.fromEntries(
          Object.entries(row).map(([key, value]) => [
            key,
            serializeQueryValue(value),
          ]),
        ),
      );
    return {
      columns: metadata.fields.map((field) => field.name),
      rows,
      rowCount: rows.length,
      truncated,
      message: truncated
        ? "Showing the first 1,000 PostgreSQL rows."
        : rows.length
          ? "Query executed successfully against PostgreSQL."
          : "The query matched no rows.",
    };
  });
}
