import { executeDatabaseQuery, getDatabase } from "@/lib/server/database/database";
import { isSameHostOrigin } from "@/lib/server/transport/requestOrigin";
import type { NextApiRequest, NextApiResponse } from "next";

/**
 * Accepts a POST with a SQL query, executes it using the server-owned pool,
 * and returns the query result as JSON.
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
  if (
    req.headers.origin &&
    !isSameHostOrigin(req.headers.origin, req.headers.host)
  ) {
    return res
      .status(403)
      .json({ error: "Cross-site requests are not allowed." });
  }
  if (typeof req.body?.query !== "string" || !req.body.query.trim())
    return res.status(400).json({ error: "A SQL query is required." });
  try {
    const database = getDatabase();
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
