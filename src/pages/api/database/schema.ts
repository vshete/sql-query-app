import { getDatabaseSchema } from "@/lib/server/database/databaseSchema";
import { isSameHostOrigin } from "@/lib/server/transport/requestOrigin";
import type { NextApiRequest, NextApiResponse } from "next";

/** GET reads cached metadata; POST explicitly refreshes it. Neither owns a connection. */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  res.setHeader("Cache-Control", "no-store");
  if (!["GET", "POST"].includes(req.method ?? "")) {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "Method not allowed" });
  }
  if (
    req.method === "POST" &&
    req.headers.origin &&
    !isSameHostOrigin(req.headers.origin, req.headers.host)
  ) {
    return res
      .status(403)
      .json({ error: "Cross-site requests are not allowed." });
  }
  try {
    const schema = await getDatabaseSchema(undefined, req.method === "POST");
    return res.json({ tables: schema.tables });
  } catch (error) {
    return res.status(503).json({
      error:
        error instanceof Error
          ? error.message
          : "Could not load database schema.",
    });
  }
}
