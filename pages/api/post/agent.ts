import { getDatabasePool } from "@/app/services/database";
import { getAgentConfig } from "@/app/services/agentConfig";
import type { NextApiRequest, NextApiResponse } from "next";
import { runQueryAgent } from "@/app/services/queryAgent";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const request = req.body?.request;
  if (typeof request !== "string" || !request.trim()) {
    return res.status(400).json({ error: "A natural-language request is required." });
  }

  try {
    getDatabasePool();
    const { provider, apiKey, model } = getAgentConfig();
    const result = await runQueryAgent(request.trim(), provider, apiKey, model);
    return res.status(200).json(result);
  } catch (error) {
    console.error("Query agent failed:", error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : "The query agent failed.",
    });
  }
}
