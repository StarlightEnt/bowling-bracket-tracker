/**
 * CSV Score Import
 * Parses bowling center score exports and matches bowlers by name.
 * Compatible with the same CSV format used in the SFGGC portal.
 *
 * Required columns: "Bowler name", "Scratch", "Game number"
 * Extra columns are ignored.
 */

const REQUIRED_COLUMNS = ["Bowler name", "Scratch", "Game number"];

export const validateColumns = (headers) => {
  const missing = REQUIRED_COLUMNS.filter(
    (col) => !headers.some((h) => h.trim().toLowerCase() === col.toLowerCase())
  );
  return missing.length === 0
    ? { valid: true }
    : { valid: false, missing };
};

/**
 * Pivot CSV rows into a per-bowler map keyed by normalized name.
 * Accumulates scores for games 1–6.
 */
export const pivotRowsByBowler = (rows) => {
  const bowlers = new Map();
  for (const row of rows) {
    const name = (row["Bowler name"] || "").trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (!bowlers.has(key)) {
      bowlers.set(key, {
        name,
        scores: {}, // gameNumber -> raw score
      });
    }
    const gameNum = parseInt(row["Game number"], 10);
    const score = parseInt(row["Scratch"], 10);
    if (!isNaN(gameNum) && !isNaN(score)) {
      bowlers.get(key).scores[gameNum] = score;
    }
  }
  return bowlers;
};

/**
 * Match pivoted CSV bowlers to database bowlers by name.
 * Returns { matched, unmatched }.
 *
 * matched: [{ bowlerId, name, gameNumber, rawScore }]
 * unmatched: [{ name, reason }]
 */
export const matchBowlers = (bowlerMap, dbBowlers, gameNumber) => {
  // Build a name index from the DB
  const nameIndex = new Map();
  for (const b of dbBowlers) {
    const key = b.name.toLowerCase().trim();
    if (!nameIndex.has(key)) nameIndex.set(key, []);
    nameIndex.get(key).push(b);
  }

  const matched = [];
  const unmatched = [];

  for (const [key, csvBowler] of bowlerMap) {
    const score = csvBowler.scores[gameNumber];
    if (score === undefined) continue; // this bowler has no score for this game

    const candidates = nameIndex.get(key) || [];
    if (candidates.length === 0) {
      unmatched.push({ name: csvBowler.name, reason: "Name not found in roster" });
      continue;
    }
    if (candidates.length > 1) {
      unmatched.push({ name: csvBowler.name, reason: "Multiple bowlers with this name" });
      continue;
    }
    matched.push({
      bowlerId: candidates[0].id,
      name: csvBowler.name,
      gameNumber,
      rawScore: score,
      existingScore: candidates[0][`game${gameNumber}`] ?? null,
    });
  }

  return { matched, unmatched };
};
