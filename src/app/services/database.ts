import { Pool, type QueryConfig } from 'pg';
import type { DatabaseQueryResult } from '../types/query.types';
import { cleanAndValidateSql } from './sqlValidation';

const globalDatabase = globalThis as typeof globalThis & { queryAppPool?: Pool };
const MAX_ROWS = 1000;

export function getDatabasePool(): Pool {
  if (!process.env.DATABASE_URL) {
    throw new Error('Set DATABASE_URL in your .env file to connect to PostgreSQL.');
  }
  if (!globalDatabase.queryAppPool) {
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 10,
      connectionTimeoutMillis: 5000,
      idleTimeoutMillis: 30000,
      statement_timeout: 10000,
    });
    pool.on('error', (error) => console.error('PostgreSQL idle connection error:', error.message));
    globalDatabase.queryAppPool = pool;
  }
  return globalDatabase.queryAppPool;
}

export async function executeDatabaseQuery(sql: string, signal?: AbortSignal): Promise<DatabaseQueryResult> {
  const validated = cleanAndValidateSql(sql);
  signal?.throwIfAborted();
  const client = await getDatabasePool().connect();
  let discard = false;
  try {
    signal?.throwIfAborted();
    await client.query('BEGIN READ ONLY');
    await client.query("SET LOCAL search_path TO public, pg_catalog");
    await client.query("SET LOCAL statement_timeout = '10s'");
    await client.query("SET LOCAL lock_timeout = '3s'");
    // A server-side cursor caps memory use while preserving the original SQL.
    const declaration: QueryConfig & { queryMode: string } = {
      text: `DECLARE query_result NO SCROLL CURSOR FOR ${validated.sql}`, queryMode: 'extended',
    };
    await client.query(declaration);
    const result = await client.query(`FETCH FORWARD ${MAX_ROWS + 1} FROM query_result`);
    signal?.throwIfAborted();
    await client.query('COMMIT');
    const truncated = result.rows.length > MAX_ROWS;
    // Serialize dates, arrays and JSON consistently with the API response.
    const rows = result.rows.slice(0, MAX_ROWS).map((row) => Object.fromEntries(
      Object.entries(row).map(([key, value]) => [key,
        value instanceof Date ? value.toISOString() :
          value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'
            ? value : JSON.stringify(value) ?? null,
      ]),
    ));
    return {
      columns: result.fields.map((field) => field.name),
      rows,
      rowCount: rows.length,
      truncated,
      message: truncated ? 'Showing the first 1,000 PostgreSQL rows.' :
        rows.length ? 'Query executed successfully against PostgreSQL.' : 'The query matched no rows.',
    };
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch { discard = true; }
    throw error;
  } finally {
    client.release(discard);
  }
}
