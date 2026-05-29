import { query, calcHandicap } from "../../../utils/db.js";
import { requireAdmin } from "../../../utils/session.js";

export default async function handler(req, res) {
  if (req.method === "GET") {
    // Public — anyone can view bowler list
    const { rows } = await query(
      "SELECT id, name, avg, handicap FROM bowlers ORDER BY name ASC"
    );
    return res.status(200).json({ bowlers: rows });
  }

  if (req.method === "POST") {
    if (!requireAdmin(req, res)) return;
    const { name, email, avg } = req.body || {};
    if (!name || avg === undefined) {
      return res.status(400).json({ error: "name and avg are required" });
    }
    const average = parseInt(avg, 10);
    if (isNaN(average) || average < 0 || average > 300) {
      return res.status(400).json({ error: "avg must be 0–300" });
    }
    const handicap = calcHandicap(average);
    try {
      const { rows } = await query(
        `INSERT INTO bowlers (name, email, avg, handicap)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (name) DO UPDATE SET avg = $3, handicap = $4, email = COALESCE($2, bowlers.email)
         RETURNING id, name, avg, handicap`,
        [name.trim(), email || null, average, handicap]
      );
      return res.status(200).json({ bowler: rows[0] });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  if (req.method === "DELETE") {
    if (!requireAdmin(req, res)) return;
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: "id required" });
    await query("DELETE FROM bowlers WHERE id = $1", [id]);
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
