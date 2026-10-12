import type { NextApiRequest, NextApiResponse } from "next";
import {
  connectDatabase,
  CONNECTION_COOKIE,
  connectionIdFromCookie,
  disconnectDatabase,
  getDatabaseConnection,
} from "@/app/services/databaseConnections";
import { getDatabaseSchema } from "@/app/services/databaseSchema";

/**
 * Manages the database connection identified by an HTTP-only cookie.
 * GET returns connection status and schema; POST connects to DATABASE_URL
 * or refreshes the schema when refresh is true; DELETE disconnects and clears
 * the cookie. Disables response caching and rejects cross-site mutations.
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  res.setHeader("Cache-Control", "no-store");
  const id = connectionIdFromCookie(req.headers.cookie);
  if (!["GET", "POST", "DELETE"].includes(req.method || "")) {
    res.setHeader("Allow", "GET, POST, DELETE");
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (
    req.method !== "GET" &&
    req.headers.origin &&
    new URL(req.headers.origin).host !== req.headers.host
  ) {
    return res
      .status(403)
      .json({ error: "Cross-site requests are not allowed." });
  }

  const cookie = (value: string, maxAge: number) =>
    `${CONNECTION_COOKIE}=${value}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAge}${process.env.NODE_ENV === "production" ? "; Secure" : ""}`;
  try {
    if (req.method === "DELETE") {
      await disconnectDatabase(id);
      res.setHeader("Set-Cookie", cookie("", 0));
      return res.json({ connected: false });
    }
    if (req.method === "POST" && req.body?.refresh !== true) {
      if (!process.env.DATABASE_URL?.trim()) {
        return res.status(400).json({
          error:
            "Set DATABASE_URL in your .env file to connect to the default database.",
        });
      }
      const result = await connectDatabase();
      await disconnectDatabase(id);
      res.setHeader("Set-Cookie", cookie(result.id, 3600));
      return res.json({
        connected: true,
        label: result.connection.label,
        tableCount: result.schema.tables.length,
        tables: result.schema.tables,
        suggestions: result.schema.suggestions,
      });
    }

    if (!id && req.method === "GET") return res.json({ connected: false });
    const connection = getDatabaseConnection(id);

    const schema = await getDatabaseSchema(
      connection.database,
      req.body?.refresh === true,
    );

    return res.json({
      connected: true,
      label: connection.label,
      tableCount: schema.tables.length,
      tables: schema.tables,
      suggestions: schema.suggestions,
    });
  } catch (error) {
    return res.status(400).json({
      error:
        error instanceof Error ? error.message : "Database connection failed.",
    });
  }
}
