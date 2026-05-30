import { query } from "../../../utils/db.js";

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const { rows } = await query("SELECT key, value FROM settings ORDER BY key");
  const settings = {};
  for (const row of rows) settings[row.key] = row.value;

  res.setHeader("Cache-Control", "public, max-age=30");
  return res.status(200).json({ settings });
}
