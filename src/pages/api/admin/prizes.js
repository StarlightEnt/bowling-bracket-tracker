import { query } from "../../../utils/db.js";
import { requireAdmin } from "../../../utils/session.js";

export default async function handler(req, res) {
  const { bracket_id } = req.query;

  if (req.method === "GET") {
    if (!bracket_id) return res.status(400).json({ error: "bracket_id required" });
    const { rows } = await query(
      "SELECT * FROM bracket_prizes WHERE bracket_id = $1 ORDER BY place ASC",
      [bracket_id]
    );
    return res.status(200).json({ prizes: rows });
  }

  if (req.method === "POST") {
    if (!requireAdmin(req, res)) return;
    const { bracket_id: bid, place, label, amount } = req.body || {};
    if (!bid || !place || !label || amount === undefined) {
      return res.status(400).json({ error: "bracket_id, place, label, amount required" });
    }
    const { rows } = await query(
      `INSERT INTO bracket_prizes (bracket_id, place, label, amount)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (bracket_id, place) DO UPDATE SET label = $3, amount = $4
       RETURNING *`,
      [bid, place, label, amount]
    );
    return res.status(200).json({ prize: rows[0] });
  }

  if (req.method === "DELETE") {
    if (!requireAdmin(req, res)) return;
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: "id required" });
    await query("DELETE FROM bracket_prizes WHERE id = $1", [id]);
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
