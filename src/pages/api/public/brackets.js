import { query } from "../../../utils/db.js";

/**
 * Public API — no auth required.
 * Returns full bracket state for display.
 * Called every 30s by the public bracket display for live updates.
 */
export default async function handler(req, res) {
  const { bracket_id } = req.query;

  if (bracket_id) {
    // Single bracket detail
    const { rows: brackets } = await query(
      "SELECT * FROM brackets WHERE id = $1",
      [bracket_id]
    );
    if (brackets.length === 0) return res.status(404).json({ error: "Bracket not found" });
    const bracket = brackets[0];

    // All entries with bowler info
    const { rows: entries } = await query(
      `SELECT e.id, e.position, e.quadrant, e.bowler_id,
              b.name AS bowler_name, b.avg, b.handicap
       FROM entries e
       JOIN bowlers b ON b.id = e.bowler_id
       WHERE e.bracket_id = $1
       ORDER BY e.position ASC`,
      [bracket_id]
    );

    // All game scores for bowlers in this bracket
    const bowlerIds = entries.map((e) => e.bowler_id);
    let scores = [];
    if (bowlerIds.length > 0) {
      const placeholders = bowlerIds.map((_, i) => `$${i + 1}`).join(",");
      const { rows } = await query(
        `SELECT bowler_id, game_number, raw_score FROM game_scores
         WHERE bowler_id IN (${placeholders}) ORDER BY game_number ASC`,
        bowlerIds
      );
      scores = rows;
    }

    // Matchup results
    const { rows: matchups } = await query(
      `SELECT game_number, positions, winner_position
       FROM matchup_results
       WHERE bracket_id = $1
       ORDER BY game_number ASC`,
      [bracket_id]
    );

    // Build effective scores per entry per game
    const handicap = bracket.bracket_type === "handicap";
    const scoreMap = {}; // bowlerId -> gameNumber -> raw
    for (const s of scores) {
      if (!scoreMap[s.bowler_id]) scoreMap[s.bowler_id] = {};
      scoreMap[s.bowler_id][s.game_number] = s.raw_score;
    }

    const entriesWithScores = entries.map((e) => {
      const rawByGame = scoreMap[e.bowler_id] || {};
      const effectiveByGame = {};
      for (const [game, raw] of Object.entries(rawByGame)) {
        effectiveByGame[game] = handicap ? raw + e.handicap : raw;
      }
      return { ...e, rawByGame, effectiveByGame };
    });

    // Prizes for this bracket
    const { rows: prizes } = await query(
      "SELECT place, label, amount FROM bracket_prizes WHERE bracket_id = $1 ORDER BY place ASC",
      [bracket_id]
    );

    // Cache for 15 seconds (live display polls every 30s)
    res.setHeader("Cache-Control", "public, max-age=15");
    return res.status(200).json({
      bracket,
      entries: entriesWithScores,
      matchups,
      prizes,
      updatedAt: new Date().toISOString(),
    });
  }

  // All brackets summary
  const { rows: brackets } = await query(
    `SELECT b.id, b.name, b.bracket_type, b.status, b.current_game,
            COUNT(e.id) AS entry_count
     FROM brackets b
     LEFT JOIN entries e ON e.bracket_id = b.id
     GROUP BY b.id ORDER BY b.bracket_type, b.name ASC`
  );

  res.setHeader("Cache-Control", "public, max-age=15");
  return res.status(200).json({ brackets });
}
