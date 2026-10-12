import type { NextApiRequest, NextApiResponse } from "next";
import { executeDatabaseQuery } from "@/app/services/database";
import {
  connectionIdFromCookie,
  getDatabaseConnection,
} from "@/app/services/databaseConnections";

/**
 * Accepts a POST with a SQL query, executes it using the database connection
 * identified by the request cookie, and returns the query result as JSON.
 * Rejects missing queries and reports connection or execution errors.
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }
  if (typeof req.body?.query !== "string" || !req.body.query.trim())
    return res.status(400).json({ error: "A SQL query is required." });
  try {
    const { database } = getDatabaseConnection(
      connectionIdFromCookie(req.headers.cookie),
    );
    const result = await executeDatabaseQuery(
      req.body.query,
      undefined,
      database,
    );
    return res.json(result);
  } catch (error) {
    return res.status(400).json({
      error: error instanceof Error ? error.message : "Query execution failed.",
    });
  }
}
