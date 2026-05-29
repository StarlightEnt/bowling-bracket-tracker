import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/router";
import Layout from "../../components/Layout/Layout";

const ROUND_LABELS = ["Game 1", "Game 2", "Game 3", "Game 4", "Game 5", "Game 6 — Final"];
const TOTAL_ROUNDS = 6;

export default function BracketDetailPage() {
  const router = useRouter();
  const { id } = router.query;
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(null);

  const fetchData = useCallback(async () => {
    if (!id) return;
    const res = await fetch(`/api/public/brackets?bracket_id=${id}`);
    if (res.ok) {
      const json = await res.json();
      setData(json);
      setLastUpdate(new Date());
    }
    setLoading(false);
  }, [id]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  if (loading) return <Layout><p style={{ color: "var(--color-text-muted)" }}>Loading bracket...</p></Layout>;
  if (!data) return <Layout><p style={{ color: "var(--color-danger)" }}>Bracket not found.</p></Layout>;

  const { bracket, entries, matchups } = data;

  const entryByPos = {};
  for (const e of entries) entryByPos[e.position] = e;

  const matchupMap = {};
  for (const m of matchups) {
    if (!matchupMap[m.game_number]) matchupMap[m.game_number] = {};
    if (!matchupMap[m.game_number][m.positions]) {
      matchupMap[m.game_number][m.positions] = [];
    }
    if (m.winner_position) {
      matchupMap[m.game_number][m.positions].push(m.winner_position);
    }
  }

  // Determine which positions are alive after each round
  const aliveByRound = {};
  aliveByRound[0] = new Set(entries.map((e) => e.position));

  for (let game = 1; game <= TOTAL_ROUNDS; game++) {
    const roundMatchups = matchupMap[game] || {};
    const winners = new Set();
    for (const winnerPositions of Object.values(roundMatchups)) {
      for (const wp of winnerPositions) winners.add(wp);
    }
    aliveByRound[game] = winners.size > 0 ? winners : null;
  }

  // Only show rounds that have actually been reached
  // Game 1 always shows if there are entries
  // Game N only shows if game N-1 produced winners
  const visibleUpToGame = (() => {
    if (entries.length === 0) return 0;
    let maxVisible = 1;
    for (let g = 2; g <= TOTAL_ROUNDS; g++) {
      if (aliveByRound[g - 1] && aliveByRound[g - 1].size > 0) {
        maxVisible = g;
      }
    }
    return maxVisible;
  })();

  const rounds = [];
  for (let game = 1; game <= visibleUpToGame; game++) {
    const groupSize = Math.pow(2, game);
    const groups = [];
    for (let slotStart = 1; slotStart <= 64; slotStart += groupSize) {
      const slotEnd = slotStart + groupSize - 1;
      const posInSlot = [];
      for (let p = slotStart; p <= slotEnd; p++) {
        if (entryByPos[p]) posInSlot.push(p);
      }
      if (posInSlot.length > 0) groups.push(posInSlot);
    }
    rounds.push({ game, groups });
  }

  const isHandicap = bracket.bracket_type === "handicap";

  return (
    <Layout>
      <div style={{ marginBottom: "1.5rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
          <h1 className="page-title" style={{ margin: 0 }}>
            <span>{bracket.name}</span>
          </h1>
          <span className={`badge badge-${bracket.bracket_type}`}>{bracket.bracket_type}</span>
          <span className={`badge badge-${bracket.status}`}>{bracket.status}</span>
          {bracket.status === "active" && (
            <div className="live-indicator"><div className="pulse" />Live</div>
          )}
        </div>
        <p style={{ color: "var(--color-text-muted)", marginTop: "0.25rem", fontSize: "0.85rem" }}>
          {entries.length} / 64 entries
          {isHandicap && " · Scores include handicap"}
          {lastUpdate &