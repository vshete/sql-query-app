import { mock } from "node:test";
import type { QueryOptions, Transaction } from "sequelize";
import { getDatabase } from "../src/lib/server/database/database";

interface TestClient {
  query(sql: string): Promise<{ rows: object[]; fields: { name: string }[] }>;
  release(): void;
}

// Keep Sequelize's real transaction lifecycle; replace only database I/O.
export function mockDatabaseClient(factory?: () => Promise<TestClient>) {
  const manager = getDatabase().connectionManager;
  mock.method(manager, "releaseConnection", (client: TestClient) =>
    client.release(),
  );
  return factory
    ? mock.method(manager, "getConnection", factory)
    : mock.method(manager, "getConnection");
}

export async function transactionQuery(sql: string, options?: QueryOptions) {
  const transaction = options?.transaction as
    (Transaction & { connection: TestClient }) | undefined;
  if (!transaction) throw new Error("Expected a Sequelize transaction");
  const result = await transaction.connection.query(sql);
  return [result.rows, result];
}
