import { neon } from "@neondatabase/serverless";

const getDb = () => neon(process.env.DATABASE_URL);

/**
 * Generic query helper matching the pattern from the original portal.
 * Returns { rows } for consistency.
 */
export async function query(text, params = []) {
  const sql = getDb();
  const rows = await sql(text, params);
  return { rows };
}

/**
 * Calculate USBC handicap from a bowler's entering average.
 * Formula: FLOOR(0.90 × MAX(0, 225 − average))
 */
export function calcHandicap(average) {
  return Math.floor(0.9 * Math.max(0, 225 - average));
}

/**
 * Determine which quadrant (1–4) a bracket position (1–64) falls into.
 */
export function positionToQuadrant(position) {
  if (position <= 16) return 1;
  if (position <= 32) return 2;
  if (position <= 48) return 3;
  return 4;
}

/**
 * Get the position range for a quadrant.
 */
export function quadrantRange(quadrant) {
  const start = (quadrant - 1) * 16 + 1;
  const end = quadrant * 16;
  return { start, end };
}

/**
 * Given a list of entries with their game scores, resolve matchups for a round.
 * Returns an array of matchup groups (each group is an array of entries).
 *
 * Round 1: pairs by position (1v2, 3v4, ...)
 * Round N: winners of prior round matchups face each other
 */
export function buildMatchups(entries, gameNumber) {
  // Sort entries by position
  const sorted = [...entries].sort((a, b) => a.position - b.position);

  if (gameNumber === 1) {
    // Pair up adjacent positions
    const groups = [];
    for (let i = 0; i < sorted.length; i += 2) {
      const group = [sorted[i]];
      if (sorted[i + 1]) group.push(sorted[i + 1]);
      groups.push(group);
    }
    return groups;
  }

  // For subsequent rounds, group by which "bracket slot" they'd occupy
  // based on the branching structure from round 1.
  // Group size doubles each round: round 1 = 2, round 2 = 4, round 3 = 8, etc.
  const groupSize = Math.pow(2, gameNumber);
  const groups = [];
  for (let i = 0; i < sorted.length; i += groupSize) {
    groups.push(sorted.slice(i, i + groupSize));
  }
  return groups;
}

/**
 * Given a matchup group and their scores for a game, determine the winner(s).
 * Handles ties by advancing all tied top scorers.
 * Returns array of winning positions.
 */
export function resolveMatchup(group, scoresByPosition) {
  const withScores = group
    .map((entry) => ({
      position: entry.position,
      score: scoresByPosition[entry.position] ?? null,
    }))
    .filter((e) => e.score !== null);

  if (withScores.length === 0) return [];

  const maxScore = Math.max(...withScores.map((e) => e.score));
  return withScores
    .filter((e) => e.score === maxScore)
    .map((e) => e.position);
}
