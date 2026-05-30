import { query } from "../../../utils/db.js";
import { requireAdmin } from "../../../utils/session.js";

export default async function handler(req, res) {
  if (req.method !== "DELETE") return res.status(405).json({ error: "Method not allowed" });
  if (!requireAdmin(req, res)) return;

  const { game_number } = req.body || {};

  // Full reset — delete everything
  if (game_number === "all") {
    await query("DELETE FROM matchup_results");
    await query("DELETE FROM game_scores");
    await query("UPDATE brackets SET current_game = 0");
    return res.status(200).json({ ok: true, message: "All scores and results cleared" });
  }

  const g = parseInt(game_number, 10);
  if (isNaN(g) || g < 1 || g > 6) {
    return res.status(400).json({ error: "game_number must be 1–6 or 'all'" });
  }

  // Check that no later game scores exist
  const { rows: later } = await query(
    "SELECT COUNT(*) AS cnt FROM game_scores WHERE game_number > $1",
    [g]
  );
  if (parseInt(later[0].cnt) > 0) {
    return res.status(400).json({
      error: `Cannot delete Game ${g} — later games have scores. Delete in reverse order (latest first).`
    });
  }

  // Delete scores and matchup results for this game
  await query("DELETE FROM game_scores WHERE game_number = $1", [g]);
  await query("DELETE FROM matchup_results WHERE game_number = $1", [g]);

  // Roll back current_game on all brackets to g-1
  await query(
    "UPDATE brackets SET current_game = $1 WHERE current_game >= $1",
    [g - 1]
  );

  return res.status(200).json({ ok: true, message: `Game ${g} scores and results deleted` });
}
