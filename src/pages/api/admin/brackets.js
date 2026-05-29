import { query } from "../../../utils/db.js";
import { requireAdmin } from "../../../utils/session.js";

export default async function handler(req, res) {
  if (req.method === "GET") {
    const { rows } = await query(
      "SELECT * FROM brackets ORDER BY bracket_type, name ASC"
    );
    return res.status(200).json({ brackets: rows });
  }

  if (req.method === "POST") {
    if (!requireAdmin(req, res)) return;
    const { name, bracket_type } = req.body || {};
    if (!name || !bracket_type) {
      return res.status(400).json({ error: "name and bracket_type required" });
    }
    if (!["scratch", "handicap"].includes(bracket_type)) {
      return res.status(400).json({ error: "bracket_type must be scratch or handicap" });
    }
    // Validate naming convention
    const upperName = name.trim().toUpperCase();
    if (!/^(SB|HB)\d+$/.test(upperName)) {
      return res.status(400).json({ error: "Name must follow pattern SB1, HB2, etc." });
    }
    try {
      const { rows } = await query(
        `INSERT INTO brackets (name, bracket_type) VALUES ($1, $2) RETURNING *`,
        [upperName, bracket_type]
      );
      return res.status(200).json({ bracket: rows[0] });
    } catch (err) {
      if (err.message.includes("unique")) {
        return res.status(409).json({ error: `Bracket ${upperName} already exists` });
      }
      return res.status(500).json({ error: err.message });
    }
  }

  if (req.method === "DELETE") {
    if (!requireAdmin(req, res)) return;
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: "id required" });
    await query("DELETE FROM brackets WHERE id = $1", [id]);
    return res.status(200).json({ ok: true });
  }

  if (req.method === "PATCH") {
    if (!requireAdmin(req, res)) return;
    const { id } = req.query;
    const { status, current_game } = req.body || {};
    if (!id) return res.status(400).json({ error: "id required" });
    const { rows } = await query(
      `UPDATE brackets SET
         status = COALESCE($1, status),
         current_game = COALESCE($2, current_game)
       WHERE id = $3 RETURNING *`,
      [status || null, current_game ?? null, id]
    );
    return res.status(200).json({ bracket: rows[0] });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
