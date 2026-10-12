import {
  connectionIdFromCookie,
  getDatabaseConnection,
} from "@/app/services/databaseConnections";
import { getAgentConfig } from "@/app/services/agentConfig";
import type { NextApiRequest, NextApiResponse } from "next";
import { runQueryAgent } from "@/app/services/queryAgent";

/**
 * Accepts a POST with a natural-language request and runs the query agent
 * using the configured provider/model and the cookie's database connection.
 * Returns the agent result as JSON, or an error for invalid input or failures.
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const request = req.body?.request;
  if (typeof request !== "string" || !request.trim()) {
    return res
      .status(400)
      .json({ error: "A natural-language request is required." });
  }

  try {
    const { database } = getDatabaseConnection(
      connectionIdFromCookie(req.headers.cookie),
    );
    const { provider, apiKey, model } = getAgentConfig();
    const result = await runQueryAgent(
      request.trim(),
      provider,
      apiKey,
      model,
      { database },
    );
    return res.status(200).json(result);
  } catch (error) {
    console.error("Query agent failed:", error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : "The query agent failed.",
    });
  }
}
