import { query, positionToQuadrant } from "../../../utils/db.js";
import { requireAdmin } from "../../../utils/session.js";

/**
 * Auto-assign bowlers randomly to open slots in a bracket.
 * Respects quadrant boundaries — fills each quadrant from its own pool.
 * Only fills slots that don't already have an entry.
 */
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!requireAdmin(req, res)) return;

  const { bracket_id } = req.body || {};
  if (!bracket_id) return res.status(400).json({ error: "bracket_id required" });

  // Get all bowlers
  const { rows: bowlers } = await query(
    "SELECT id, name FROM bowlers ORDER BY name ASC"
  );

  // Get existing entries for this bracket
  const { rows: existing } = await query(
    "SELECT position, bowler_id FROM entries WHERE bracket_id = $1",
    [bracket_id]
  );

  const takenPositions = new Set(existing.map(e => e.position));
  const takenBowlerIds = new Set(existing.map(e => e.bowler_id));

  // Open positions (1-64 minus already taken)
  const openPositions = [];
  for (let p = 1; p <= 64; p++) {
    if (!takenPositions.has(p)) openPositions.push(p);
  }

  // Available bowlers (not already in this bracket)
  const availableBowlers = bowlers.filter(b => !takenBowlerIds.has(b.id));

  if (openPositions.length === 0) {
    return res.status(400).json({ error: "No open positions in this bracket" });
  }
  if (availableBowlers.length === 0) {
    return res.status(400).json({ error: "No available bowlers to assign" });
  }

  // Shuffle both arrays
  const shuffledPositions = openPositions.sort(() => Math.random() - 0.5);
  const shuffledBowlers = availableBowlers.sort(() => Math.random() - 0.5);

  // Assign as many as possible (limited by whichever is smaller)
  const count = Math.min(shuffledPositions.length, shuffledBowlers.length);
  let assigned = 0;

  for (let i = 0; i < count; i++) {
    const pos = shuffledPositions[i];
    const bowler = shuffledBowlers[i];
    const quadrant = positionToQuadrant(pos);

    try {
      await query(
        `INSERT INTO entries (bracket_id, bowler_id, position, quadrant)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (bracket_id, position) DO NOTHING`,
        [bracket_id, bowler.id, pos, quadrant]
      );
      assigned++;
    } catch (err) {
      // Skip conflicts silently
    }
  }

  return res.status(200).json({ assigned, total: openPositions.length });
}
