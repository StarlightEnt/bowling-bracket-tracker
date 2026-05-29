import { query, positionToQuadrant } from "../../../utils/db.js";
import { requireAdmin } from "../../../utils/session.js";

export default async function handler(req, res) {
  if (req.method === "GET") {
    const { bracket_id } = req.query;
    if (!bracket_id) return res.status(400).json({ error: "bracket_id required" });

    const { rows } = await query(
      `SELECT e.id, e.position, e.quadrant, e.bowler_id,
              b.name AS bowler_name, b.avg, b.handicap
       FROM entries e
       JOIN bowlers b ON b.id = e.bowler_id
       WHERE e.bracket_id = $1
       ORDER BY e.position ASC`,
      [bracket_id]
    );
    return res.status(200).json({ entries: rows });
  }

  if (req.method === "POST") {
    if (!requireAdmin(req, res)) return;
    // Assign a bowler to a specific position (chip draw result)
    const { bracket_id, bowler_id, position } = req.body || {};
    if (!bracket_id || !bowler_id || !position) {
      return res.status(400).json({ error: "bracket_id, bowler_id, and position required" });
    }
    const pos = parseInt(position, 10);
    if (isNaN(pos) || pos < 1 || pos > 64) {
      return res.status(400).json({ error: "position must be 1–64" });
    }

    // Check slot is open
    const { rows: existing } = await query(
      "SELECT id FROM entries WHERE bracket_id = $1 AND position = $2",
      [bracket_id, pos]
    );
    if (existing.length > 0) {
      return res.status(409).json({ error: `Position ${pos} is already taken` });
    }

    const quadrant = positionToQuadrant(pos);
    try {
      const { rows } = await query(
        `INSERT INTO entries (bracket_id, bowler_id, position, quadrant)
         VALUES ($1, $2, $3, $4) RETURNING *`,
        [bracket_id, bowler_id, pos, quadrant]
      );
      return res.status(200).json({ entry: rows[0] });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  if (req.method === "DELETE") {
    if (!requireAdmin(req, res)) return;
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: "id required" });
    await query("DELETE FROM entries WHERE id = $1", [id]);
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
