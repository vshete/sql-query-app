import type { NextApiRequest, NextApiResponse } from "next";
import { getManualQueryCsv } from "@/app/services/manualQuery";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", "attachment; filename=query_results.csv");
  return res.status(200).send(getManualQueryCsv());
}
