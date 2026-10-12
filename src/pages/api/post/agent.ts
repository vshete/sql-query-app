import { getAgentConfig } from "@/app/services/agentConfig";
import { getDatabase } from "@/app/services/database";
import { runQueryAgent } from "@/app/services/queryAgent";
import { isSameHostOrigin } from "@/app/services/requestOrigin";
import { MAX_REQUEST_LENGTH } from "@/app/types/queryProtocol";
import type { NextApiRequest, NextApiResponse } from "next";

/**
 * Accepts a POST with a natural-language request and runs the query agent
 * using the configured provider/model and server-owned database pool.
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
  if (
    req.headers.origin &&
    !isSameHostOrigin(req.headers.origin, req.headers.host)
  ) {
    return res
      .status(403)
      .json({ error: "Cross-site requests are not allowed." });
  }

  const request = req.body?.request;
  if (
    typeof request !== "string" ||
    !request.trim() ||
    request.length > MAX_REQUEST_LENGTH
  ) {
    return res.status(400).json({
      error: `A request of 1–${MAX_REQUEST_LENGTH} characters is required.`,
    });
  }

  try {
    const database = getDatabase();
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
