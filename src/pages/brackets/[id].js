import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/router";
import Head from "next/head";

const TOTAL_ROUNDS = 6;
const ROUND_LABELS = ["Gm 1", "Gm 2", "Gm 3", "Gm 4", "Gm 5", "Gm 6"];

// Layout constants — tuned for 16:9 display
const SLOT_H = 18;        // height of one name slot
const SLOT_GAP = 2;       // gap between slots in a matchup
const LINE_W = 14;        // width of connector stub lines
const COL_W = 200;        // width of each round column (wider for hdcp scores)
const COL_GAP = 20;       // gap between columns
const MARGIN_TOP = 48;    // top margin (below header)
const MARGIN_LEFT = 8;
const BRACKET_H = 800;    // usable bracket height

export default function BracketPage() {
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

  if (loading) return <Screen><p style={{ color: "#94a3b8" }}>Loading bracket...</p></Screen>;
  if (!data) return <Screen><p style={{ color: "#ef4444" }}>Bracket not found.</p></Screen>;

  const { bracket, entries, matchups } = data;
  const isHdcp = bracket.bracket_type === "handicap";

  // Build lookups
  const entryByPos = {};
  for (const e of entries) entryByPos[e.position] = e;

  const matchupMap = {};
  for (const m of matchups) {
    if (!matchupMap[m.game_number]) matchupMap[m.game_number] = {};
    if (!matchupMap[m.game_number][m.positions]) matchupMap[m.game_number][m.positions] = [];
    if (m.winner_position) matchupMap[m.game_number][m.positions].push(m.winner_position);
  }

  // Alive positions after each game
  const aliveAfter = {};
  aliveAfter[0] = new Set(entries.map(e => e.position));
  for (let g = 1; g <= TOTAL_ROUNDS; g++) {
    const rm = matchupMap[g] || {};
    const w = new Set();
    for (const wps of Object.values(rm)) for (const p of wps) w.add(p);
    aliveAfter[g] = w.size > 0 ? w : null;
  }

  // Score display for a position in a game
  const scoreStr = (pos, game) => {
    const e = entryByPos[pos];
    if (!e) return "";
    const raw = e.rawByGame?.[game];
    if (raw == null) return "";
    if (isHdcp) {
      const h = e.handicap || 0;
      return `${raw}+${h}=${raw + h}`;
    }
    return String(raw);
  };

  // Winners for a matchup group in a game
  const winnersOf = (alive, game) => {
    if (!alive || alive.length === 0) return [];
    const key = alive.slice().sort((a, b) => a - b).join(",");
    return matchupMap[game]?.[key] || [];
  };

  // Build half-bracket data: positions 1-32 (left) or 33-64 (right)
  // Returns array of rounds, each round is array of matchup groups
  // Each group is array of slot objects: { pos, name, score, status }
  const buildHalf = (startPos) => {
    const half = Array.from({ length: 32 }, (_, i) => i + startPos);
    const rounds = [];

    for (let game = 1; game <= 5; game++) {
      const groupSize = Math.pow(2, game);
      const groups = [];

      for (let i = 0; i < 32; i += groupSize) {
        const positions = half.slice(i, i + groupSize);

        if (game === 1) {
          // Game 1: show all positions as pairs
          for (let j = 0; j < positions.length; j += 2) {
            const pair = positions.slice(j, j + 2);
            const winners = winnersOf(pair, 1);
            groups.push(pair.map(pos => ({
              pos,
              name: entryByPos[pos]?.bowler_name || "",
              score: scoreStr(pos, 1),
              status: winners.length > 0
                ? (winners.includes(pos) ? "winner" : "lost")
                : "pending"
            })));
          }
        } else {
          // Game N: only show winners from prior round
          const priorAlive = aliveAfter[game - 1];
          const alive = priorAlive ? positions.filter(p => priorAlive.has(p)) : [];
          const winners = winnersOf(alive, game);
          if (alive.length > 0) {
            groups.push(alive.map(pos => ({
              pos,
              name: entryByPos[pos]?.bowler_name || "",
              score: scoreStr(pos, game),
              status: winners.length > 0
                ? (winners.includes(pos) ? "winner" : "lost")
                : "pending"
            })));
          } else {
            // Placeholder empty group to maintain tree structure
            groups.push([{ pos: null, name: "", score: "", status: "empty" }]);
          }
        }
      }
      rounds.push(groups);
    }
    return rounds;
  };

  const leftRounds = buildHalf(1);
  const rightRounds = buildHalf(33);

  // Finals (game 6)
  const leftFinalist = aliveAfter[5] ? [...aliveAfter[5]].filter(p => p <= 32) : [];
  const rightFinalist = aliveAfter[5] ? [...aliveAfter[5]].filter(p => p >= 33) : [];
  const allFinalists = [...leftFinalist, ...rightFinalist];
  const finalWinners = winnersOf(allFinalists, 6);
  const champion = aliveAfter[6]?.size === 1 ? [...aliveAfter[6]][0] : null;

  // Total SVG width: left half + center + right half
  const halfW = 5 * (COL_W + COL_GAP);
  const centerW = isHdcp ? 220 : 170;
  const totalW = halfW * 2 + centerW + MARGIN_LEFT * 2;

  return (
    <>
      <Head><title>{bracket.name} — Bracket Tracker</title></Head>
      <div style={{
        background: "#0a0c0f",
        width: "100vw",
        height: "100vh",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        fontFamily: "'Barlow Condensed', 'Arial Narrow', Arial, sans-serif",
        color: "#e2e8f0",
      }}>
        {/* Header bar */}
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 1rem",
          height: "40px",
          flexShrink: 0,
          background: "#111418",
          borderBottom: "2px solid #f59e0b",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <span style={{ fontSize: "1.4rem", fontWeight: 800, color: "#f59e0b", letterSpacing: "0.04em", textTransform: "uppercase" }}>
              🎳 {bracket.name}
            </span>
            <Tag color={isHdcp ? "#10b981" : "#3b82f6"}>{bracket.bracket_type}</Tag>
            {bracket.status === "active" && <LiveDot />}
          </div>
          <div style={{ fontSize: "0.65rem", color: "#475569", letterSpacing: "0.05em" }}>
            {entries.length}/64 entries
            {isHdcp ? "  ·  scores shown as raw+hdcp=total" : ""}
            {lastUpdate ? `  ·  updated ${lastUpdate.toLocaleTimeString()}` : ""}
          </div>
        </div>

        {/* Bracket canvas */}
        <div style={{ flex: 1, overflow: "auto", padding: "8px" }}>
          <svg
            width="100%"
            viewBox={`0 0 ${totalW} ${BRACKET_H + MARGIN_TOP + 20}`}
            style={{ display: "block" }}
          >
            {/* Round labels — left half */}
            {[0,1,2,3,4].map(i => (
              <text key={i}
                x={MARGIN_LEFT + i * (COL_W + COL_GAP) + COL_W / 2}
                y={MARGIN_TOP - 8}
                textAnchor="middle"
                fontSize="11"
                fill="#64748b"
                fontFamily="'Barlow Condensed', Arial Narrow, Arial"
                fontWeight="700"
                letterSpacing="1"
              >
                {ROUND_LABELS[i].toUpperCase()}
              </text>
            ))}

            {/* Round labels — right half */}
            {[0,1,2,3,4].map(i => (
              <text key={i}
                x={MARGIN_LEFT + halfW + centerW + COL_GAP + i * (COL_W + COL_GAP) + COL_W / 2}
                y={MARGIN_TOP - 8}
                textAnchor="middle"
                fontSize="11"
                fill="#64748b"
                fontFamily="'Barlow Condensed', Arial Narrow, Arial"
                fontWeight="700"
                letterSpacing="1"
              >
                {ROUND_LABELS[i].toUpperCase()}
              </text>
            ))}

            {/* Final label */}
            <text
              x={MARGIN_LEFT + halfW + centerW / 2}
              y={MARGIN_TOP - 8}
              textAnchor="middle"
              fontSize="11"
              fill="#f59e0b"
              fontFamily="'Barlow Condensed', Arial Narrow, Arial"
              fontWeight="700"
              letterSpacing="1"
            >
              {ROUND_LABELS[5].toUpperCase()} — FINAL
            </text>

            {/* Left half bracket */}
            <HalfBracket
              rounds={leftRounds}
              side="left"
              xOffset={MARGIN_LEFT}
              isHdcp={isHdcp}
            />

            {/* Right half bracket */}
            <HalfBracket
              rounds={rightRounds}
              side="right"
              xOffset={MARGIN_LEFT + halfW + centerW + COL_GAP}
              isHdcp={isHdcp}
            />

            {/* Finals column */}
            <Finals
              leftFinalists={leftFinalist}
              rightFinalists={rightFinalist}
              entryByPos={entryByPos}
              finalWinners={finalWinners}
              champion={champion}
              xCenter={MARGIN_LEFT + halfW + centerW / 2}
              isHdcp={isHdcp}
              scoreStr={scoreStr}
            />
          </svg>
        </div>

        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;600;700;800&display=swap');
          @keyframes pulse-dot { 0%,100%{opacity:1} 50%{opacity:.3} }
        `}</style>
      </div>
    </>
  );
}

// Renders one half of the bracket (left or right)
function HalfBracket({ rounds, side, xOffset, isHdcp }) {
  const isRight = side === "right";

  return (
    <g>
      {rounds.map((groups, roundIdx) => {
        const game = roundIdx + 1;
        const colX = isRight
          ? xOffset + (4 - roundIdx) * (COL_W + COL_GAP)
          : xOffset + roundIdx * (COL_W + COL_GAP);

        // Number of slots in game 1 = 32 bowlers = 16 pairs
        // Each subsequent round halves
        const slotsPerGroup = Math.pow(2, game);
        const totalSlots = 32;
        const slotH = BRACKET_H / totalSlots;

        // For game 1: 16 groups of 2
        // For game 2: 8 groups of 2 (only winners)
        // etc.
        const numGroups = game === 1 ? 16 : Math.pow(2, 5 - game + 1) / 2;

        return groups.map((group, gi) => {
          if (!group || group.length === 0) return null;

          // Y position: each group spans slotsPerGroup * slotH height
          const groupH = slotsPerGroup * slotH;
          const groupY = MARGIN_TOP + gi * groupH;
          const centerY = groupY + groupH / 2;

          // For game 1 groups are pairs; for later games show the alive group
          const slotCount = group.length;
          const totalGroupH = slotCount * (SLOT_H + SLOT_GAP) - SLOT_GAP;
          const startY = centerY - totalGroupH / 2;

          return (
            <g key={`r${roundIdx}-g${gi}`}>
              {group.map((slot, si) => {
                if (!slot) return null;
                const slotY = startY + si * (SLOT_H + SLOT_GAP);
                const midY = slotY + SLOT_H / 2;

                // Connector line stub
                const lineX1 = isRight ? colX + COL_W : colX;
                const lineX2 = isRight ? colX + COL_W + LINE_W : colX - LINE_W;

                return (
                  <g key={si}>
                    {/* Connector stub */}
                    {slot.status !== "empty" && (
                      <line
                        x1={lineX1}
                        y1={midY}
                        x2={lineX2}
                        y2={midY}
                        stroke={slot.status === "winner" ? "#f59e0b" : "#2a313d"}
                        strokeWidth="1"
                      />
                    )}

                    {/* Slot background */}
                    {slot.status !== "empty" && (
                      <rect
                        x={colX}
                        y={slotY}
                        width={COL_W}
                        height={SLOT_H}
                        fill={slot.status === "winner" ? "rgba(245,158,11,0.12)" : "rgba(22,26,32,0.9)"}
                        stroke={slot.status === "winner" ? "#f59e0b" : "#1e2530"}
                        strokeWidth="0.5"
                        rx="2"
                      />
                    )}

                    {/* Empty slot line (unfilled bracket position) */}
                    {slot.status === "empty" && (
                      <line
                        x1={colX}
                        y1={slotY + SLOT_H / 2}
                        x2={colX + COL_W}
                        y2={slotY + SLOT_H / 2}
                        stroke="#1e2530"
                        strokeWidth="0.75"
                      />
                    )}

                    {/* Position number */}
                    {slot.pos && (
                      <text
                        x={colX + 4}
                        y={slotY + SLOT_H / 2}
                        dominantBaseline="central"
                        fontSize="9"
                        fill="#475569"
                        fontFamily="'Barlow Condensed', Arial Narrow, Arial"
                        fontWeight="600"
                      >
                        {slot.pos}
                      </text>
                    )}

                    {/* Name */}
                    {slot.name && (
                      <text
                        x={colX + 18}
                        y={slotY + SLOT_H / 2}
                        dominantBaseline="central"
                        fontSize="10"
                        fill={slot.status === "winner" ? "#f59e0b" : slot.status === "lost" ? "#374151" : "#cbd5e1"}
                        fontFamily="'Barlow Condensed', Arial Narrow, Arial"
                        fontWeight={slot.status === "winner" ? "700" : "400"}
                        textDecoration={slot.status === "lost" ? "line-through" : "none"}
                      >
                        {slot.name.length > 18 ? slot.name.slice(0, 17) + "…" : slot.name}
                      </text>
                    )}

                    {/* Score */}
                    {slot.score && (
                      <text
                        x={colX + COL_W - 4}
                        y={slotY + SLOT_H / 2}
                        textAnchor="end"
                        dominantBaseline="central"
                        fontSize="9"
                        fill={slot.status === "winner" ? "#f59e0b" : "#64748b"}
                        fontFamily="'Barlow Condensed', Arial Narrow, Arial"
                        fontWeight="700"
                      >
                        {slot.score}
                      </text>
                    )}
                  </g>
                );
              })}

              {/* Vertical connector line between slots in a group (game > 1) */}
              {game > 1 && group.length > 1 && group[0].status !== "empty" && (
                <line
                  x1={isRight ? colX + COL_W + LINE_W : colX - LINE_W}
                  y1={startY + SLOT_H / 2}
                  x2={isRight ? colX + COL_W + LINE_W : colX - LINE_W}
                  y2={startY + (group.length - 1) * (SLOT_H + SLOT_GAP) + SLOT_H / 2}
                  stroke="#2a313d"
                  strokeWidth="1"
                />
              )}

              {/* Game 1 vertical bracket line between pairs */}
              {game === 1 && group.length === 2 && (
                <>
                  <line
                    x1={isRight ? colX + COL_W + LINE_W : colX - LINE_W}
                    y1={startY + SLOT_H / 2}
                    x2={isRight ? colX + COL_W + LINE_W : colX - LINE_W}
                    y2={startY + SLOT_H + SLOT_GAP + SLOT_H / 2}
                    stroke="#2a313d"
                    strokeWidth="1"
                  />
                  {/* Horizontal connector to next round */}
                  <line
                    x1={isRight ? colX + COL_W + LINE_W : colX - LINE_W}
                    y1={centerY}
                    x2={isRight ? colX + COL_W + LINE_W + COL_GAP + 0 : colX - LINE_W - COL_GAP}
                    y2={centerY}
                    stroke="#2a313d"
                    strokeWidth="1"
                  />
                </>
              )}
            </g>
          );
        });
      })}
    </g>
  );
}

// Finals/championship column in the center
function Finals({ leftFinalists, rightFinalists, entryByPos, finalWinners, champion, xCenter, isHdcp, scoreStr }) {
  const slotW = isHdcp ? 200 : 155;
  const slotX = xCenter - slotW / 2;
  const midY = MARGIN_TOP + BRACKET_H / 2;

  const renderFinalist = (pos, yPos) => {
    const entry = entryByPos[pos];
    const isWinner = finalWinners.includes(pos) || champion === pos;
    const isLost = (finalWinners.length > 0 || champion) && !isWinner;
    const score = scoreStr(pos, 6);

    return (
      <g key={pos}>
        <rect
          x={slotX} y={yPos}
          width={slotW} height={SLOT_H}
          fill={isWinner ? "rgba(245,158,11,0.15)" : "rgba(22,26,32,0.9)"}
          stroke={isWinner ? "#f59e0b" : "#2a313d"}
          strokeWidth={isWinner ? "1" : "0.5"}
          rx="2"
        />
        <text x={slotX + 4} y={yPos + SLOT_H / 2} dominantBaseline="central" fontSize="9" fill="#475569" fontFamily="'Barlow Condensed', Arial Narrow, Arial" fontWeight="600">
          {pos}
        </text>
        <text
          x={slotX + 18} y={yPos + SLOT_H / 2}
          dominantBaseline="central" fontSize="10"
          fill={isWinner ? "#f59e0b" : isLost ? "#374151" : "#cbd5e1"}
          fontFamily="'Barlow Condensed', Arial Narrow, Arial"
          fontWeight={isWinner ? "700" : "400"}
          textDecoration={isLost ? "line-through" : "none"}
        >
          {entry?.bowler_name?.slice(0, 18) || "—"}
        </text>
        {score && (
          <text x={slotX + slotW - 4} y={yPos + SLOT_H / 2} textAnchor="end" dominantBaseline="central" fontSize="9" fill={isWinner ? "#f59e0b" : "#64748b"} fontFamily="'Barlow Condensed', Arial Narrow, Arial" fontWeight="700">
            {score}
          </text>
        )}
      </g>
    );
  };

  // Position finalists above and below center trophy
  const trophyH = champion ? 60 : 40;
  const gap = 8;

  const leftSlots = leftFinalists.map((pos, i) => renderFinalist(pos, midY - trophyH / 2 - gap - (leftFinalists.length - i) * (SLOT_H + gap)));
  const rightSlots = rightFinalists.map((pos, i) => renderFinalist(pos, midY + trophyH / 2 + gap + i * (SLOT_H + gap)));

  return (
    <g>
      {leftSlots}
      {rightSlots}

      {/* Trophy / champion */}
      <text x={xCenter} y={midY - 12} textAnchor="middle" fontSize="24" dominantBaseline="central">🏆</text>
      {champion ? (
        <>
          <text x={xCenter} y={midY + 14} textAnchor="middle" fontSize="9" fill="#f59e0b" fontFamily="'Barlow Condensed', Arial Narrow, Arial" fontWeight="700" letterSpacing="1">
            CHAMPION
          </text>
          <text x={xCenter} y={midY + 28} textAnchor="middle" fontSize="12" fill="#f59e0b" fontFamily="'Barlow Condensed', Arial Narrow, Arial" fontWeight="800">
            {entryByPos[champion]?.bowler_name}
          </text>
        </>
      ) : (
        <text x={xCenter} y={midY + 18} textAnchor="middle" fontSize="9" fill="#374151" fontFamily="'Barlow Condensed', Arial Narrow, Arial">
          awaiting finalists
        </text>
      )}
    </g>
  );
}

function Screen({ children }) {
  return (
    <div style={{ background: "#0a0c0f", width: "100vw", height: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      {children}
    </div>
  );
}

function Tag({ color, children }) {
  return (
    <span style={{
      fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase",
      padding: "0.15rem 0.45rem", borderRadius: "3px",
      background: color + "22", color,
    }}>
      {children}
    </span>
  );
}

function LiveDot() {
  return (
    <span style={{ display: "flex", alignItems: "center", gap: "0.3rem", fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.1em", color: "#10b981" }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#10b981", display: "inline-block", animation: "pulse-dot 1.5s infinite" }} />
      LIVE
    </span>
  );
}
