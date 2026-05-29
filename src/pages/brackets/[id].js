import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/router";
import Head from "next/head";

const TOTAL_ROUNDS = 6;
const ROUND_LABELS = ["Gm1", "Gm2", "Gm3", "Gm4", "Gm5", "Gm6"];

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

  const matchupMap = {};
  for (const m of matchups) {
    if (!matchupMap[m.game_number]) matchupMap[m.game_number] = {};
    if (!matchupMap[m.game_number][m.positions]) matchupMap[m.game_number][m.positions] = [];
    if (m.winner_position) matchupMap[m.game_number][m.positions].push(m.winner_position);
  }

  // Alive positions after each round — only set if winners actually exist
  const aliveByRound = {};
  aliveByRound[0] = new Set(entries.map(e => e.position));
  for (let g = 1; g <= TOTAL_ROUNDS; g++) {
    const rm = matchupMap[g] || {};
    const w = new Set();
    for (const wp of Object.values(rm)) for (const p of wp) w.add(p);
    aliveByRound[g] = w.size > 0 ? w : null;
  }

  const isHandicap = bracket.bracket_type === "handicap";

  // Get raw score and handicap for display
  const getScoreDisplay = (pos, game) => {
    const entry = entryByPos[pos];
    if (!entry) return null;
    const raw = entry.rawByGame?.[game];
    if (raw === undefined || raw === null) return null;
    if (isHandicap) {
      const hdcp = entry.handicap || 0;
      const total = raw + hdcp;
      return { raw, hdcp, total, display: `${raw}+${hdcp}=${total}` };
    }
    return { raw, display: String(raw) };
  };

  // Get winner positions for a matchup group in a given game
  // Only returns winners if scores have actually been entered
  const getWinners = (positions, game) => {
    const priorAlive = aliveByRound[game - 1];
    const alive = priorAlive ? positions.filter(p => priorAlive.has(p)) : positions;
    if (alive.length === 0) return { alive: [], winners: [] };
    const key = alive.slice().sort((a, b) => a - b).join(",");
    const winners = matchupMap[game]?.[key] || [];
    return { alive, winners };
  };

  // Build position groups for a half-bracket and round
  const buildGroups = (halfPositions, game) => {
    const groupSize = Math.pow(2, game);
    const sorted = halfPositions.slice().sort((a, b) => a - b);
    const groups = [];
    for (let i = 0; i < sorted.length; i += groupSize) {
      groups.push(sorted.slice(i, i + groupSize));
    }
    return groups;
  };

  // Only show rounds that have actual resolved winners
  // Game 1 always shows. Game N only shows if game N-1 has winners.
  const maxVisibleGame = (() => {
    if (entries.length === 0) return 0;
    let max = 1;
    for (let g = 2; g <= TOTAL_ROUNDS; g++) {
      if (aliveByRound[g - 1] && aliveByRound[g - 1].size > 0) max = g;
    }
    return max;
  })();

  const leftPositions = Array.from({ length: 32 }, (_, i) => i + 1);
  const rightPositions = Array.from({ length: 32 }, (_, i) => i + 33);
  const isHandicapBracket = bracket.bracket_type === "handicap";
  const champion = aliveByRound[6]?.size === 1 ? [...aliveByRound[6]][0] : null;

  // How many columns to show on each side (max 5, center is game 6)
  const visibleSideGames = Math.min(maxVisibleGame, 5);
  const showFinal = maxVisibleGame >= 6;

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
              background: isHandicapBracket ? "rgba(16,185,129,0.2)" : "rgba(59,130,246,0.2)",
              color: isHandicapBracket ? "#10b981" : "#3b82f6"
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
            {entries.length}/64 entries{isHandicapBracket ? " · Handicap: raw+hdcp=total" : ""}{lastUpdate ? ` · Updated ${lastUpdate.toLocaleTimeString()}` : ""}
          </div>
        </div>

        {/* Bracket area */}
        <div style={{ flex: 1, display: "flex", overflow: "hidden", padding: "0.3rem 0.5rem", gap: "0.3rem" }}>

          {/* LEFT HALF — positions 1-32 */}
          <div style={{ flex: 1, display: "flex", gap: "2px", overflow: "hidden" }}>
            {Array.from({ length: visibleSideGames }, (_, i) => i + 1).map(game => (
              <BracketColumn
                key={game}
                game={game}
                positions={leftPositions}
                entryByPos={entryByPos}
                aliveByRound={aliveByRound}
                getWinners={getWinners}
                buildGroups={buildGroups}
                getScoreDisplay={getScoreDisplay}
                label={ROUND_LABELS[game - 1]}
                side="left"
                isHandicap={isHandicapBracket}
              />
            ))}
          </div>

          {/* CENTER — Game 6 Final */}
          <div style={{ width: isHandicapBracket ? "200px" : "150px", flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "0.5rem" }}>
            <div style={{ fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#64748b", marginBottom: "0.25rem" }}>
              {ROUND_LABELS[5]} — Final
            </div>

            {showFinal ? (
              <>
                <ChampionSlot side="left" positions={leftPositions} aliveByRound={aliveByRound} matchupMap={matchupMap} entryByPos={entryByPos} getScoreDisplay={getScoreDisplay} champion={champion} isHandicap={isHandicapBracket} />
                <div style={{ textAlign: "center", padding: "0.3rem 0" }}>
                  {champion ? (
                    <div>
                      <div style={{ fontSize: "1.5rem" }}>🏆</div>
                      <div style={{ fontSize: "0.6rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#f59e0b" }}>Champion</div>
                      <div style={{ fontSize: "0.8rem", fontWeight: 600, color: "#f59e0b", marginTop: "0.15rem" }}>{entryByPos[champion]?.bowler_name}</div>
                    </div>
                  ) : (
                    <div style={{ fontSize: "1.2rem", opacity: 0.3 }}>🏆</div>
                  )}
                </div>
                <ChampionSlot side="right" positions={rightPositions} aliveByRound={aliveByRound} matchupMap={matchupMap} entryByPos={entryByPos} getScoreDisplay={getScoreDisplay} champion={champion} isHandicap={isHandicapBracket} />
              </>
            ) : (
              <div style={{ textAlign: "center", opacity: 0.2 }}>
                <div style={{ fontSize: "1.5rem" }}>🏆</div>
                <div style={{ fontSize: "0.6rem", color: "#64748b", marginTop: "0.25rem" }}>Awaiting finalists</div>
              </div>
            )}
          </div>

          {/* RIGHT HALF — positions 33-64, mirrored */}
          <div style={{ flex: 1, display: "flex", gap: "2px", overflow: "hidden", flexDirection: "row-reverse" }}>
            {Array.from({ length: visibleSideGames }, (_, i) => i + 1).map(game => (
              <BracketColumn
                key={game}
                game={game}
                positions={rightPositions}
                entryByPos={entryByPos}
                aliveByRound={aliveByRound}
                getWinners={getWinners}
                buildGroups={buildGroups}
                getScoreDisplay={getScoreDisplay}
                label={ROUND_LABELS[game - 1]}
                side="right"
                isHandicap={isHandicapBracket}
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

function BracketColumn({ game, positions, entryByPos, aliveByRound, getWinners, buildGroups, getScoreDisplay, label, side, isHandicap }) {
  const groups = buildGroups(positions, game);

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
      <div style={{ fontSize: "0.6rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#64748b", textAlign: "center", paddingBottom: "0.2rem", borderBottom: "1px solid #2a313d", marginBottom: "0.2rem" }}>
        {label}
      </div>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "2px", justifyContent: "space-around" }}>
        {groups.map((groupPositions, gi) => {
          const { alive, winners } = getWinners(groupPositions, game);

          // For game 1: show all positions in the bracket
          // For game N: only show the winners from the prior round
          const displayPositions = game === 1 ? groupPositions : alive;
          if (displayPositions.length === 0) return <div key={gi} style={{ flex: 1 }} />;

          return (
            <MatchupGroup
              key={gi}
              positions={displayPositions}
              game={game}
              entryByPos={entryByPos}
              winners={winners}
              getScoreDisplay={getScoreDisplay}
              side={side}
              isHandicap={isHandicap}
            />
          );
        })}
      </div>
    </div>
  );
}

function MatchupGroup({ positions, game, entryByPos, winners, getScoreDisplay, side, isHandicap }) {
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", gap: "1px" }}>
      {positions.map((pos) => {
        const entry = entryByPos[pos];
        const isWinner = winners.includes(pos);
        const isEliminated = winners.length > 0 && !isWinner;
        const scoreInfo = getScoreDisplay(pos, game);

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
            {scoreInfo && (
              <span style={{
                fontSize: isHandicap ? "0.55rem" : "0.65rem",
                fontWeight: 700,
                color: isWinner ? "#f59e0b" : "#94a3b8",
                whiteSpace: "nowrap",
                textAlign: "right",
              }}>
                {scoreInfo.display}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

function ChampionSlot({ positions, aliveByRound, matchupMap, entryByPos, getScoreDisplay, champion, isHandicap }) {
  const priorAlive = aliveByRound[5];
  if (!priorAlive) return <div style={{ width: "100%", minHeight: "28px", background: "#161a20", borderRadius: "4px", border: "1px solid #2a313d" }} />;

  const alive = positions.filter(p => priorAlive.has(p));
  if (alive.length === 0) return <div style={{ width: "100%", minHeight: "28px", background: "#161a20", borderRadius: "4px", border: "1px solid #2a313d" }} />;

  const key = alive.slice().sort((a, b) => a - b).join(",");
  const winners = matchupMap[6]?.[key] || [];

  return (
    <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: "1px" }}>
      {alive.map(pos => {
        const entry = entryByPos[pos];
        const isWinner = winners.includes(pos) || champion === pos;
        const isEliminated = (winners.length > 0 || champion) && !isWinner;
        const scoreInfo = getScoreDisplay(pos, 6);

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
            {scoreInfo && (
              <span style={{ fontSize: isHandicap ? "0.55rem" : "0.7rem", fontWeight: 700, color: isWinner ? "#f59e0b" : "#94a3b8", whiteSpace: "nowrap" }}>
                {scoreInfo.display}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
