import { loadEnvConfig } from "@next/env";
import { Sequelize, QueryTypes } from "sequelize";
import { readFile } from "node:fs/promises";
import path from "node:path";

async function main() {
  loadEnvConfig(process.cwd());
  const connectionString =
    process.env.DATABASE_SEED_URL || process.env.DATABASE_URL;
  if (!connectionString)
    throw new Error(
      "Set DATABASE_SEED_URL or DATABASE_URL in .env before seeding.",
    );
  const database = new Sequelize(connectionString, {
    dialect: "postgres",
    logging: false,
    dialectOptions: { connectionTimeoutMillis: 5000 },
  });
  try {
    const { rows, total } = await database.transaction(async (transaction) => {
      await database.query(
        await readFile(path.join(process.cwd(), "scripts/seed.sql"), "utf8"),
        { transaction },
      );
      const rows = await database.query<{ table_name: string; rows: number }>(
        `
      SELECT 'categories' AS table_name, count(*)::int AS rows FROM public.categories
      UNION ALL SELECT 'employees', count(*)::int FROM public.employees
      UNION ALL SELECT 'customers', count(*)::int FROM public.customers
      UNION ALL SELECT 'products', count(*)::int FROM public.products
      UNION ALL SELECT 'orders', count(*)::int FROM public.orders
      UNION ALL SELECT 'order_details', count(*)::int FROM public.order_details
    `,
        { transaction, type: QueryTypes.SELECT },
      );
      const total = rows.reduce((sum, row) => sum + row.rows, 0);
      if (total < 1000)
        throw new Error(`Expected at least 1,000 records, found ${total}.`);
      return { rows, total };
    });
    console.table(rows);
    console.log(
      `Database ready: ${total} records. Existing records were preserved.`,
    );
  } finally {
    await database.close();
  }
}

main().catch((error) => {
  console.error(
    "Database seed failed:",
    error instanceof Error ? error.message : error,
  );
  process.exitCode = 1;
});
