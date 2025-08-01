import { NextApiRequest, NextApiResponse } from "next";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  // Set the response headers for CSV
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", "attachment; filename=data.csv");

  const prediefenedQueries = [
    { name: "Get All Users", query: "SELECT * FROM users;" },
    { name: "Completed Orders", query: "SELECT * FROM orders WHERE status = 'completed';" },
    { name: "Product Count", query: "SELECT COUNT(*) FROM products;" },
  ];

  // Send the CSV data
  res.status(200).send(prediefenedQueries);
}