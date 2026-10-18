import type { Sequelize } from "sequelize";
import { setTimeout as delay } from "node:timers/promises";
import { getDatabase } from "./database";
import { getDatabaseSchema } from "./databaseSchema";

const state = globalThis as typeof globalThis & {
  queryAppDatabaseInitialization?: WeakMap<Sequelize, Promise<void>>;
};
const initialization = (state.queryAppDatabaseInitialization ??= new WeakMap());

/** Warm the server-owned pool and schema before accepting requests. */
export function initializeDatabase(database = getDatabase()): Promise<void> {
  const existing = initialization.get(database);
  if (existing) return existing;
  const pending = (async () => {
    for (let attempt = 0; ; attempt++) {
      try {
        await database.authenticate();
        break;
      } catch (error) {
        if (attempt === 3) throw error;
        await delay(1000);
      }
    }
    await getDatabaseSchema(database);
  })().catch((error: unknown) => {
    initialization.delete(database);
    throw error;
  });
  initialization.set(database, pending);
  return pending;
}
