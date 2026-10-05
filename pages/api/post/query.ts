import type { NextApiRequest, NextApiResponse } from "next";
import { getManualQueryPage } from "@/app/services/manualQuery";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }
  if (typeof req.body?.query !== "string" || !req.body.query.trim()) {
    return res.status(400).json({ error: "A SQL query is required." });
  }
  const page = positiveInteger(req.body.page, 1);
  const perPage = positiveInteger(req.body.perPage, 10);
  const result = getManualQueryPage(page, perPage);
  if (!result) return res.status(400).json({ error: "Page is out of range." });
  return res.status(200).json(result);
}

function positiveInteger(value: unknown, fallback: number) {
  const number = Number(value);
  return Number.isSafeInteger(number) && number > 0 ? number : fallback;
}
