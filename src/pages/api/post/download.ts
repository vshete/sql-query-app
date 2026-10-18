import { executeDatabaseQuery, getDatabase } from "@/lib/server/database/database";
import type { NextApiRequest, NextApiResponse } from "next";
import { queryResultCsv } from "@/lib/shared/queryResults";
import { isSameHostOrigin } from "@/lib/server/transport/requestOrigin";

/**
 * Accepts a POST with a SQL query and executes it using the server-owned pool.
 * Returns the columns and rows as an escaped CSV attachment,
 * or a JSON error if the query is missing or execution fails.
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
    const csv = queryResultCsv(result);
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=query_results.csv",
    );
    return res.send(csv);
  } catch (error) {
    return res.status(400).json({
      error: error instanceof Error ? error.message : "Download failed.",
    });
  }
}
