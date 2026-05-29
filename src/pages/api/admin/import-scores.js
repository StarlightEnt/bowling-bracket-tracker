import formidable from "formidable";
import fs from "fs";
import { parse } from "csv-parse/sync";
import { query } from "../../../utils/db.js";
import { requireAdmin } from "../../../utils/session.js";
import {
  validateColumns,
  pivotRowsByBowler,
  matchBowlers,
} from "../../../utils/importScoresCsv.js";

export const config = { api: { bodyParser: false } };

/**
 * After saving raw scores, compute bracket progression for all active brackets.
 * For each bracket, resolve matchups for the given game number and store winners.
 */
async function computeBracketResults(gameNumber) {
  // Get all active brackets
  const { rows: brackets } = await query(
    "SELECT * FROM brackets WHERE status = 'active'"
  );

  for (const bracket of brackets) {
    // Get all entries for this bracket with their effective score for this game
    const { rows: entries } = await query(
      `SELECT e.id, e.position, e.bowler_id, e.quadrant,
              b.handicap,
              gs.raw_score,
              CASE
                WHEN br.bracket_type = 'handicap' THEN gs.raw_score + b.handicap
                ELSE gs.raw_score
              END AS effective_score
       FROM entries e
       JOIN bowlers b ON b.id = e.bowler_id
       JOIN brackets br ON br.id = e.bracket_id
       LEFT JOIN game_scores gs ON gs.bowler_id = e.bowler_id AND gs.game_number = $1
       WHERE e.bracket_id = $2`,
      [gameNumber, bracket.id]
    );

    // Build map of position -> effective score
    const scoreByPosition = {};
    for (const e of entries) {
      if (e.effective_score !== null) {
        scoreByPosition[e.position] = e.effective_score;
      }
    }

    // Determine which entries are still alive (won all prior rounds)
    // For game 1: everyone is alive
    // For game N: only winners of game N-1 matchups
    let alivePositions;
    if (gameNumber === 1) {
      alivePositions = new Set(entries.map((e) => e.position));
    } else {
      const { rows: priorWinners } = await query(
        `SELECT winner_position FROM matchup_results
         WHERE bracket_id = $1 AND game_number = $2 AND winner_position IS NOT NULL`,
        [bracket.id, gameNumber - 1]
      );
      alivePositions = new Set(priorWinners.map((r) => r.winner_position));
    }

    // Filter to alive entries only
    const aliveEntries = entries.filter((e) => alivePositions.has(e.position));
    if (aliveEntries.length === 0) continue;

    // Build matchups for this round
    const groupSize = Math.pow(2, gameNumber);
    const sorted = [...aliveEntries].sort((a, b) => a.position - b.position);

    // Group positions into their bracket slots
    // Each slot covers a range based on the initial position pairing tree
    const matchupGroups = [];
    for (let slotStart = 1; slotStart <= 64; slotStart += groupSize) {
      const slotEnd = slotStart + groupSize - 1;
      const group = sorted.filter(
        (e) => e.position >= slotStart && e.position <= slotEnd
      );
      if (group.length > 0) matchupGroups.push({ slotStart, slotEnd, group });
    }

    // Resolve each matchup and store
    for (const { slotStart, slotEnd, group } of matchupGroups) {
      const positionsKey = group.map((e) => e.position).sort((a,b)=>a-b).join(",");

      // Find winner(s) — handle ties by advancing all tied top scorers
      const withScores = group
        .map((e) => ({ position: e.position, score: scoreByPosition[e.position] ?? null }))
        .filter((e) => e.score !== null);

      if (withScores.length === 0) {
        // No scores yet — upsert with null winner
        await query(
          `INSERT INTO matchup_results (bracket_id, game_number, positions, winner_position)
           VALUES ($1, $2, $3, NULL)
           ON CONFLICT (bracket_id, game_number, positions) DO NOTHING`,
          [bracket.id, gameNumber, positionsKey]
        );
        continue;
      }

      const maxScore = Math.max(...withScores.map((e) => e.score));
      const winners = withScores.filter((e) => e.score === maxScore);

      // If multiple winners (tie), insert one row per winner
      for (const winner of winners) {
        await query(
          `INSERT INTO matchup_results (bracket_id, game_number, positions, winner_position, calculated_at)
           VALUES ($1, $2, $3, $4, NOW())
           ON CONFLICT (bracket_id, game_number, positions)
           DO UPDATE SET winner_position = $4, calculated_at = NOW()`,
          [bracket.id, gameNumber, positionsKey, winner.position]
        );
      }
    }

    // Advance bracket current_game if all matchups are resolved
    await query(
      `UPDATE brackets SET current_game = $1 WHERE id = $2`,
      [gameNumber, bracket.id]
    );
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!requireAdmin(req, res)) return;

  const form = formidable({ maxFileSize: 5 * 1024 * 1024 });
  const [fields, files] = await form.parse(req);
  const file = files.file?.[0];
  const gameNumber = parseInt(fields.game_number?.[0], 10);

  if (!file) return res.status(400).json({ error: "No file uploaded" });
  if (isNaN(gameNumber) || gameNumber < 1 || gameNumber > 6) {
    return res.status(400).json({ error: "game_number must be 1–6" });
  }

  const content = fs.readFileSync(file.filepath, "utf8");
  let rows;
  try {
    rows = parse(content, { columns: true, skip_empty_lines: true, trim: true });
  } catch (err) {
    return res.status(400).json({ error: `CSV parse error: ${err.message}` });
  }

  const headers = Object.keys(rows[0] || {});
  const validation = validateColumns(headers);
  if (!validation.valid) {
    return res.status(400).json({
      error: `Missing required columns: ${validation.missing.join(", ")}`,
    });
  }

  // Pivot rows by bowler
  const bowlerMap = pivotRowsByBowler(rows);

  // Fetch all bowlers from DB
  const { rows: dbBowlers } = await query(
    "SELECT id, name FROM bowlers ORDER BY name"
  );

  const { matched, unmatched } = matchBowlers(bowlerMap, dbBowlers, gameNumber);

  // Save scores (upsert — later import wins)
  let saved = 0;
  for (const m of matched) {
    await query(
      `INSERT INTO game_scores (bowler_id, game_number, raw_score)
       VALUES ($1, $2, $3)
       ON CONFLICT (bowler_id, game_number) DO UPDATE SET raw_score = $3, imported_at = NOW()`,
      [m.bowlerId, gameNumber, m.rawScore]
    );
    saved++;
  }

  // Log the import
  await query(
    `INSERT INTO import_log (game_number, filename, rows_total, rows_matched, rows_skipped)
     VALUES ($1, $2, $3, $4, $5)`,
    [
      gameNumber,
      file.originalFilename || "unknown",
      rows.length,
      matched.length,
      unmatched.length,
    ]
  );

  // Recompute bracket results for this game
  await computeBracketResults(gameNumber);

  return res.status(200).json({
    saved,
    unmatched,
    gameNumber,
  });
}
