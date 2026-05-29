import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/router";
import Head from "next/head";

const TOTAL_ROUNDS = 6;
const ROUND_LABELS = ["Gm1", "Gm2", "Gm3", "Gm4", "Gm5", "Gm6"];

// Left side: positions 1-32, rounds go left->right
// Right side: positions 33-64, rounds go right->left
// They meet at the championship in the middle

export default function BracketDisplayPage() {
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

  if (loading) return (
    <div style={{ background: "#0d0f12", color: "#e2e8f0", display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", fontFamily: "sans-serif" }}>
      Loading bracket...
    </div>
  );

  if (!data) return (
    <div style={{ background: "#0d0f12", color: "#ef4444", display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", fontFamily: "sans-serif" }}>
      Bracket not found.
    </div>
  );

  const { bracket, entries, matchups } = data;

  const entryByPos = {};
  for (const e of entries) entryByPos[e.position] = e;

  // matchupMap[game][positionsKey] = [winnerPos, ...]
  const matchupMap = {};
  for (const m of matchups) {
    if (!matchupMap[m.game_number]) matchupMap[m.game_number] = {};
    if (!matchupMap[m.game_number][m.positions]) matchupMap[m.game_number][m.positions] = [];
    if (m.winner_position) matchupMap[m.game_number][m.positions].push(m.winner_position);
  }

  // Alive positions after each round
  const aliveByRound = {};
  aliveByRound[0] = new Set(entries.map(e => e.position));
  for (let g = 1; g <= TOTAL_ROUNDS; g++) {
    const rm = matchupMap[g] || {};
    const w = new Set();
    for (const wp of Object.values(rm)) for (const p of wp) w.add(p);
    aliveByRound[g] = w.size > 0 ? w : null;
  }

  // Get effective score for a position in a game
  const getScore = (pos, game) => {
    const entry = entryByPos[pos];
    if (!entry) return null;
    const s = entry.effectiveByGame?.[game];
    return s !== undefined && s !== null ? s : null;
  };

  // Get winner positions for a matchup group in a game
  const getWinners = (positions, game) => {
    const priorAlive = aliveByRound[game - 1];
    const alive = priorAlive ? positions.filter(p => priorAlive.has(p)) : positions;
    if (alive.length === 0) return { alive: [], winners: [] };
    const key = alive.slice().sort((a, b) => a - b).join(",");
    return { alive, winners: matchupMap[game]?.[key] || [] };
  };

  // Build slot groups for a given half and round
  // halfPositions: array of positions for this half (1-32 or 33-64)
  const buildGroups = (halfPositions, game) => {
    const groupSize = Math.pow(2, game);
    const groups = [];
    // Sort positions
    const sorted = halfPositions.slice().sort((a, b) => a - b);
    for (let i = 0; i < sorted.length; i += groupSize) {
      groups.push(sorted.slice(i, i + groupSize));
    }
    return groups;
  };

  const leftPositions = Array.from({ length: 32 }, (_, i) => i + 1).filter(p => entryByPos[p] || true);
  const rightPositions = Array.from({ length: 32 }, (_, i) => i + 33).filter(p => entryByPos[p] || true);

  const isHandicap = bracket.bracket_type === "handicap";
  const champion = aliveByRound[6]?.size === 1 ? [...aliveByRound[6]][0] : null;

  return (
    <>
      <Head>
        <title>{bracket.name} — Bracket Tracker</title>
      </Head>
      <div style={{
        background: "#0d0f12",
        color: "#e2e8f0",
        width: "100vw",
        height: "100vh",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        fontFamily: "'Barlow Condensed', 'Arial Narrow', sans-serif",
      }}>
        {/* Header */}
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0.4rem 1.2rem",
          background: "#161a20",
          borderBottom: "2px solid #f59e0b",
          flexShrink: 0,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <span style={{ fontSize: "1.6rem", fontWeight: 800, letterSpacing: "0.05em", color: "#f59e0b", textTransform: "uppercase" }}>
              🎳 {bracket.name}
            </span>
            <span style={{
              fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase",
              padding: "0.2rem 0.5rem", borderRadius: "4px",
              background: isHandicap ? "rgba(16,185,129,0.2)" : "rgba(59,130,246,0.2)",
              color: isHandicap ? "#10b981" : "#3b82f6"
            }}>
              {bracket.bracket_type}
            </span>
            {bracket.status === "active" && (
              <span style={{ display: "flex", alignItems: "center", gap: "0.3rem", fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#10b981" }}>
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#10b981", display: "inline-block", animation: "pulse 1.5s infinite" }} />
                LIVE
              </span>
            )}
          </div>
          <div style={{ fontSize: "0.7rem", color: "#64748b" }}>
            {entries.length}/64 entries · {isHandicap ? "Scores include handicap · " : ""}{lastUpdate ? `Updated ${lastUpdate.toLocaleTimeString()}` : ""}
          </div>
        </div>

        {/* Bracket area */}
        <div style={{ flex: 1, display: "flex", overflow: "hidden", padding: "0.3rem 0.5rem", gap: "0.3rem" }}>

          {/* LEFT HALF — positions 1-32, rounds 1→6 left to right */}
          <div style={{ flex: 1, display: "flex", gap: "2px", overflow: "hidden" }}>
            {[1, 2, 3, 4, 5].map(game => (
              <BracketColumn
                key={game}
                game={game}
                positions={leftPositions}
                entryByPos={entryByPos}
                aliveByRound={aliveByRound}
                matchupMap={matchupMap}
                getScore={getScore}
                getWinners={getWinners}
                buildGroups={buildGroups}
                label={ROUND_LABELS[game - 1]}
                side="left"
              />
            ))}
          </div>

          {/* CENTER — Game 6 championship */}
          <div style={{ width: "140px", flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "0.5rem" }}>
            <div style={{ fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#64748b", marginBottom: "0.25rem" }}>
              {ROUND_LABELS[5]} — Final
            </div>

            {/* Left finalist */}
            <ChampionSlot
              positions={leftPositions.slice(0, 32)}
              game={6}
              entryByPos={entryByPos}
              aliveByRound={aliveByRound}
              matchupMap={matchupMap}
              getScore={getScore}
              champion={champion}
            />

            {/* Trophy */}
            <div style={{ textAlign: "center", padding: "0.3rem 0" }}>
              {champion ? (
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: "1.5rem" }}>🏆</div>
                  <div style={{ fontSize: "0.6rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#f59e0b" }}>Champion</div>
                  <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "#f59e0b", marginTop: "0.15rem", maxWidth: "120px", textAlign: "center" }}>
                    {entryByPos[champion]?.bowler_name}
                  </div>
                </div>
              ) : (
                <div style={{ fontSize: "1.2rem", opacity: 0.3 }}>🏆</div>
              )}
            </div>

            {/* Right finalist */}
            <ChampionSlot
              positions={rightPositions.slice(0, 32)}
              game={6}
              entryByPos={entryByPos}
              aliveByRound={aliveByRound}
              matchupMap={matchupMap}
              getScore={getScore}
              champion={champion}
            />
          </div>

          {/* RIGHT HALF — positions 33-64, rounds 1→6 right to left (reversed) */}
          <div style={{ flex: 1, display: "flex", gap: "2px", overflow: "hidden", flexDirection: "row-reverse" }}>
            {[1, 2, 3, 4, 5].map(game => (
              <BracketColumn
                key={game}
                game={game}
                positions={rightPositions}
                entryByPos={entryByPos}
                aliveByRound={aliveByRound}
                matchupMap={matchupMap}
                getScore={getScore}
                getWinners={getWinners}
                buildGroups={buildGroups}
                label={ROUND_LABELS[game - 1]}
                side="right"
              />
            ))}
          </div>
        </div>

        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;600;700;800&display=swap');
          @keyframes pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.4;transform:scale(0.75)} }
        `}</style>
      </div>
    </>
  );
}

function BracketColumn({ game, positions, entryByPos, aliveByRound, matchupMap, getScore, getWinners, buildGroups, label, side }) {
  const groups = buildGroups(positions, game);
  const priorAlive = aliveByRound[game - 1];

  // Only show this column if it's game 1, or if prior round has winners
  const hasData = game === 1 || (aliveByRound[game - 1] && aliveByRound[game - 1].size > 0);
  const opacity = hasData ? 1 : 0.15;

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", opacity, minWidth: 0 }}>
      <div style={{ fontSize: "0.6rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#64748b", textAlign: "center", paddingBottom: "0.2rem", borderBottom: "1px solid #2a313d", marginBottom: "0.2rem" }}>
        {label}
      </div>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "2px", justifyContent: "space-around" }}>
        {groups.map((groupPositions, gi) => {
          const { alive, winners } = getWinners(groupPositions, game);
          const displayPositions = game === 1 ? groupPositions : alive;
          if (displayPositions.length === 0) return <div key={gi} style={{ flex: 1 }} />;

          return (
            <MatchupGroup
              key={gi}
              positions={displayPositions}
              game={game}
              entryByPos={entryByPos}
              winners={winners}
              getScore={getScore}
              side={side}
            />
          );
        })}
      </div>
    </div>
  );
}

function MatchupGroup({ positions, game, entryByPos, winners, getScore, side }) {
  return (
    <div style={{
      flex: 1,
      display: "flex",
      flexDirection: "column",
      justifyContent: "center",
      gap: "1px",
      position: "relative",
    }}>
      {positions.map((pos) => {
        const entry = entryByPos[pos];
        const isWinner = winners.includes(pos);
        const isEliminated = winners.length > 0 && !isWinner;
        const score = getScore(pos, game);

        return (
          <div key={pos} style={{
            display: "flex",
            alignItems: "center",
            gap: "3px",
            padding: "1px 4px",
            borderRadius: "2px",
            background: isWinner ? "rgba(245,158,11,0.15)" : isEliminated ? "transparent" : "rgba(30,36,45,0.8)",
            borderLeft: side === "left" ? `2px solid ${isWinner ? "#f59e0b" : isEliminated ? "#1e242d" : "#2a313d"}` : "none",
            borderRight: side === "right" ? `2px solid ${isWinner ? "#f59e0b" : isEliminated ? "#1e242d" : "#2a313d"}` : "none",
            opacity: isEliminated ? 0.35 : 1,
          }}>
            <span style={{ fontSize: "0.55rem", color: "#475569", minWidth: "16px", textAlign: "right", fontWeight: 600 }}>{pos}</span>
            <span style={{
              flex: 1,
              fontSize: "0.65rem",
              fontWeight: isWinner ? 700 : 400,
              color: isWinner ? "#f59e0b" : "#e2e8f0",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              textDecoration: isEliminated ? "line-through" : "none",
            }}>
              {entry ? entry.bowler_name : <span style={{ color: "#374151" }}>—</span>}
            </span>
            {score !== null && (
              <span style={{ fontSize: "0.65rem", fontWeight: 700, color: isWinner ? "#f59e0b" : "#94a3b8", minWidth: "26px", textAlign: "right" }}>
                {score}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

function ChampionSlot({ positions, game, entryByPos, aliveByRound, matchupMap, getScore, champion }) {
  const priorAlive = aliveByRound[5];
  if (!priorAlive) return (
    <div style={{ width: "100%", padding: "0.4rem", background: "#161a20", borderRadius: "4px", border: "1px solid #2a313d", minHeight: "32px" }} />
  );

  const alive = positions.filter(p => priorAlive.has(p));
  if (alive.length === 0) return (
    <div style={{ width: "100%", padding: "0.4rem", background: "#161a20", borderRadius: "4px", border: "1px solid #2a313d", minHeight: "32px" }} />
  );

  const key = alive.slice().sort((a, b) => a - b).join(",");
  const winners = matchupMap[6]?.[key] || [];

  return (
    <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: "1px" }}>
      {alive.map(pos => {
        const entry = entryByPos[pos];
        const isWinner = winners.includes(pos) || champion === pos;
        const isEliminated = (winners.length > 0 || champion) && !isWinner;
        const score = getScore(pos, 6);

        return (
          <div key={pos} style={{
            display: "flex",
            alignItems: "center",
            gap: "4px",
            padding: "3px 6px",
            borderRadius: "3px",
            background: isWinner ? "rgba(245,158,11,0.2)" : "#161a20",
            border: `1px solid ${isWinner ? "#f59e0b" : "#2a313d"}`,
            opacity: isEliminated ? 0.4 : 1,
          }}>
            <span style={{ fontSize: "0.6rem", color: "#475569", minWidth: "16px" }}>{pos}</span>
            <span style={{ flex: 1, fontSize: "0.7rem", fontWeight: isWinner ? 700 : 400, color: isWinner ? "#f59e0b" : "#e2e8f0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {entry?.bowler_name || "—"}
            </span>
            {score !== null && (
              <span style={{ fontSize: "0.7rem", fontWeight: 700, color: isWinner ? "#f59e0b" : "#94a3b8" }}>{score}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}
