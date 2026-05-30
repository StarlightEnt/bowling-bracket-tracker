import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/router";
import Head from "next/head";

const TOTAL_ROUNDS = 6;
const ROUND_LABELS = ["Gm 1", "Gm 2", "Gm 3", "Gm 4", "Gm 5", "Gm 6"];

const DISPLAY_W = 1920;
const DISPLAY_H = 1080;
const HEADER_H = 44;
const PADDING = 8;
const USABLE_H = DISPLAY_H - HEADER_H - PADDING * 2;
const ROUND_LABEL_H = 24;
const SLOT_H = 26;
const CENTER_W = 180;
const POS_W = 28;
const POS_GAP = 6;
const COL_GAP = 24;
const HALF_W = (DISPLAY_W - CENTER_W - PADDING * 2) / 2;
const COL_W = Math.floor((HALF_W - POS_W - POS_GAP - 4 * COL_GAP) / 5);
const SLOT_SPACING = USABLE_H / 32;

export default function BracketPage() {
  const router = useRouter();
  const { id } = router.query;
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(null);

  const fetchData = useCallback(async () => {
    if (!id) return;
    const res = await fetch(`/api/public/brackets?bracket_id=${id}`);
    if (res.ok) { const json = await res.json(); setData(json); setLastUpdate(new Date()); }
    setLoading(false);
  }, [id]);

  useEffect(() => {
    fetchData();
    const t = setInterval(fetchData, 30000);
    return () => clearInterval(t);
  }, [fetchData]);

  if (loading) return <Screen color="#94a3b8">Loading bracket...</Screen>;
  if (!data) return <Screen color="#ef4444">Bracket not found.</Screen>;

  const { bracket, entries, matchups } = data;
  const isHdcp = bracket.bracket_type === "handicap";

  const entryByPos = {};
  for (const e of entries) entryByPos[e.position] = e;

  const matchupMap = {};
  for (const m of matchups) {
    if (!matchupMap[m.game_number]) matchupMap[m.game_number] = {};
    if (!matchupMap[m.game_number][m.positions]) matchupMap[m.game_number][m.positions] = [];
    if (m.winner_position) matchupMap[m.game_number][m.positions].push(m.winner_position);
  }

  const aliveAfter = {};
  aliveAfter[0] = new Set(entries.map(e => e.position));
  for (let g = 1; g <= TOTAL_ROUNDS; g++) {
    const rm = matchupMap[g] || {};
    const w = new Set();
    for (const wps of Object.values(rm)) for (const p of wps) w.add(p);
    aliveAfter[g] = w.size > 0 ? w : null;
  }

  const getScore = (pos, game) => {
    const e = entryByPos[pos];
    if (!e) return null;
    const raw = e.rawByGame?.[game];
    if (raw == null) return null;
    const hdcp = isHdcp ? (e.handicap || 0) : 0;
    return { total: raw + hdcp, hdcp, raw };
  };

  const winnersOf = (positions, game) => {
    if (!positions || positions.length === 0) return [];
    const key = positions.slice().sort((a, b) => a - b).join(",");
    return matchupMap[game]?.[key] || [];
  };

  const leftFinalists = aliveAfter[5] ? [...aliveAfter[5]].filter(p => p <= 32) : [];
  const rightFinalists = aliveAfter[5] ? [...aliveAfter[5]].filter(p => p >= 33) : [];
  const allFinalists = [...leftFinalists, ...rightFinalists];
  const finalWinners = winnersOf(allFinalists, 6);
  const champion = aliveAfter[6]?.size === 1 ? [...aliveAfter[6]][0] : null;

  const svgW = DISPLAY_W - PADDING * 2;
  const svgH = USABLE_H + ROUND_LABEL_H + 4;
  const leftColsX = POS_W + POS_GAP;
  const rightHalfX = HALF_W + CENTER_W + COL_GAP;

  return (
    <>
      <Head><title>{bracket.name} — Bracket Tracker</title></Head>
      <div style={{
        background: "#0a0c0f", width: "100vw", height: "100vh", overflow: "hidden",
        display: "flex", flexDirection: "column",
        fontFamily: "'Barlow Condensed','Arial Narrow',Arial,sans-serif", color: "#e2e8f0",
      }}>
        <div style={{
          height: HEADER_H, flexShrink: 0, display: "flex", alignItems: "center",
          justifyContent: "space-between", padding: "0 1rem",
          background: "#111418", borderBottom: "2px solid #f59e0b",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <span style={{ fontSize: "1.5rem", fontWeight: 800, color: "#f59e0b", letterSpacing: "0.05em", textTransform: "uppercase" }}>
              🎳 {bracket.name}
            </span>
            <span style={{
              fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase",
              padding: "0.2rem 0.5rem", borderRadius: "3px",
              background: isHdcp ? "rgba(16,185,129,0.2)" : "rgba(59,130,246,0.2)",
              color: isHdcp ? "#10b981" : "#3b82f6",
            }}>{bracket.bracket_type}</span>
            {bracket.status === "active" && (
              <span style={{ display: "flex", alignItems: "center", gap: "0.3rem", fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.1em", color: "#10b981" }}>
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#10b981", display: "inline-block", animation: "pulse-dot 1.5s infinite" }} />
                LIVE
              </span>
            )}
          </div>
          <div style={{ fontSize: "0.65rem", color: "#475569" }}>
            {entries.length}/64 entries{lastUpdate ? `  ·  updated ${lastUpdate.toLocaleTimeString()}` : ""}
          </div>
        </div>

        <div style={{ flex: 1, overflow: "hidden", padding: `${PADDING}px` }}>
          <svg width="100%" height="100%"
            viewBox={`0 0 ${svgW} ${svgH}`}
            preserveAspectRatio="xMidYMid meet"
            style={{ display: "block" }}
          >
            <defs><style>{`@keyframes pulse-dot{0%,100%{opacity:1}50%{opacity:.3}}`}</style></defs>

            {[0,1,2,3,4].map(i => (
              <text key={`ll${i}`}
                x={leftColsX + i * (COL_W + COL_GAP) + COL_W / 2}
                y={ROUND_LABEL_H / 2 + 4}
                textAnchor="middle" dominantBaseline="central"
                fontSize="12" fill="#64748b"
                fontFamily="'Barlow Condensed',Arial Narrow,Arial"
                fontWeight="700" letterSpacing="1.5">
                {ROUND_LABELS[i].toUpperCase()}
              </text>
            ))}

            {[0,1,2,3,4].map(i => (
              <text key={`rl${i}`}
                x={rightHalfX + (4 - i) * (COL_W + COL_GAP) + COL_W / 2}
                y={ROUND_LABEL_H / 2 + 4}
                textAnchor="middle" dominantBaseline="central"
                fontSize="12" fill="#64748b"
                fontFamily="'Barlow Condensed',Arial Narrow,Arial"
                fontWeight="700" letterSpacing="1.5">
                {ROUND_LABELS[i].toUpperCase()}
              </text>
            ))}

            <text x={HALF_W + CENTER_W / 2} y={ROUND_LABEL_H / 2 + 4}
              textAnchor="middle" dominantBaseline="central"
              fontSize="12" fill="#f59e0b"
              fontFamily="'Barlow Condensed',Arial Narrow,Arial"
              fontWeight="800" letterSpacing="1.5">
              {ROUND_LABELS[5].toUpperCase()} — FINAL
            </text>

            <BracketHalf
              startPos={1} side="left"
              colsX={leftColsX}
              posNumX={POS_W - 2}
              yOffset={ROUND_LABEL_H}
              entryByPos={entryByPos}
              aliveAfter={aliveAfter}
              winnersOf={winnersOf}
              getScore={getScore}
              isHdcp={isHdcp}
            />

            <BracketHalf
              startPos={33} side="right"
              colsX={rightHalfX}
              posNumX={rightHalfX + 5 * (COL_W + COL_GAP) - COL_GAP + POS_GAP + POS_W}
              yOffset={ROUND_LABEL_H}
              entryByPos={entryByPos}
              aliveAfter={aliveAfter}
              winnersOf={winnersOf}
              getScore={getScore}
              isHdcp={isHdcp}
            />

            <Finals
              leftFinalists={leftFinalists}
              rightFinalists={rightFinalists}
              entryByPos={entryByPos}
              finalWinners={finalWinners}
              champion={champion}
              xCenter={HALF_W + CENTER_W / 2}
              yOffset={ROUND_LABEL_H}
              getScore={getScore}
              isHdcp={isHdcp}
            />
          </svg>
        </div>
        <style>{`@keyframes pulse-dot{0%,100%{opacity:1}50%{opacity:.3}}`}</style>
      </div>
    </>
  );
}

function BracketHalf({ startPos, side, colsX, posNumX, yOffset, entryByPos, aliveAfter, winnersOf, getScore, isHdcp }) {
  const isRight = side === "right";
  const half = Array.from({ length: 32 }, (_, i) => i + startPos);
  const els = [];

  for (let game = 1; game <= 5; game++) {
    // Column X: left=game1 leftmost, right=game1 rightmost
    const colIdx = isRight ? (5 - game) : (game - 1);
    const colX = colsX + colIdx * (COL_W + COL_GAP);

    // Bracket line X is on the side facing next round (toward center)
    // Left: right edge of cell; Right: left edge of cell
    const bracketX = isRight ? colX : colX + COL_W;
    // Stub starts from opposite (outer) edge
    const stubX = isRight ? colX + COL_W : colX;

    // Feed line end: bracket line X of next column
    const nextColIdx = isRight ? (4 - game) : game;
    const nextColX = colsX + nextColIdx * (COL_W + COL_GAP);
    const feedEndX = isRight ? nextColX + COL_W : nextColX;

    // Each cell in this round independently occupies a span of game-1 slots
    // Game 1: span=1, Game 2: span=2, Game 3: span=4, Game 4: span=8, Game 5: span=16
    const span = Math.pow(2, game - 1);
    const numCells = 32 / span;

    for (let ci = 0; ci < numCells; ci++) {
      const firstOrigIdx = ci * span;
      const lastOrigIdx = firstOrigIdx + span - 1;
      const positions = half.slice(firstOrigIdx, lastOrigIdx + 1);

      // This cell's vertical center = midpoint of its game-1 source span
      const topY = yOffset + firstOrigIdx * SLOT_SPACING;
      const botY = yOffset + (lastOrigIdx + 1) * SLOT_SPACING;
      const centerY = (topY + botY) / 2;
      const slotY = centerY - SLOT_H / 2;
      const midY = centerY;

      // Determine slot content
      let pos = null;
      let status = "empty";

      if (game === 1) {
        pos = positions[0];
        // Find this position's pair
        const pairIdx = ci % 2 === 0 ? ci + 1 : ci - 1;
        const pairPos = half[pairIdx * span];
        const pair = [pos, pairPos].sort((a, b) => a - b);
        const winners = winnersOf(pair, 1);
        status = winners.length > 0 ? (winners.includes(pos) ? "winner" : "lost") : "pending";
      } else {
        // Show the winner of the source matchup from the previous round
        const priorAlive = aliveAfter[game - 1];
        if (!priorAlive) continue;
        const alive = positions.filter(p => priorAlive.has(p));
        if (alive.length !== 1) continue; // no winner yet or ambiguous
        pos = alive[0];
        const thisGameAlive = aliveAfter[game];
        status = thisGameAlive
          ? (thisGameAlive.has(pos) ? "winner" : "lost")
          : "pending";
      }

      if (pos === null) continue;

      const score = getScore(pos, game);
      const name = entryByPos[pos]?.bowler_name || "";

      // Draw bracket connector lines
      // For each cell, draw its stub AND the vertical+feed lines for its pair grouping
      // Pair grouping: cells ci=0&1 form a pair for game+1, ci=2&3 form a pair, etc.
      const isFirstOfPair = ci % 2 === 0;

      if (isFirstOfPair && game < 5) {
        // Check if the paired cell also has a winner (so we can draw the bracket)
        const pairCI = ci + 1;
        const pairFirstIdx = pairCI * span;
        const pairLastIdx = pairFirstIdx + span - 1;
        const pairPositions = half.slice(pairFirstIdx, pairLastIdx + 1);

        let pairCenterY = yOffset + (pairFirstIdx + span / 2) * SLOT_SPACING;

        // Vertical line between this cell's center and the pair cell's center
        els.push(<line key={`vert-${game}-${ci}`}
          x1={bracketX} y1={midY}
          x2={bracketX} y2={pairCenterY}
          stroke="#2a3545" strokeWidth="1.5" />);

        // Feed line from midpoint between the two to next column
        const feedY = (midY + pairCenterY) / 2;
        els.push(<line key={`feed-${game}-${ci}`}
          x1={bracketX} y1={feedY}
          x2={feedEndX} y2={feedY}
          stroke="#2a3545" strokeWidth="1.5" />);
      }

      // Stub from outer cell edge to bracket line
      els.push(<line key={`stub-${game}-${ci}`}
        x1={stubX} y1={midY} x2={bracketX} y2={midY}
        stroke={status === "winner" ? "#f59e0b" : "#1e2a38"} strokeWidth="1" />);

      // Cell background
      els.push(<rect key={`bg-${game}-${ci}`}
        x={colX} y={slotY} width={COL_W} height={SLOT_H}
        fill={status === "winner" ? "rgba(245,158,11,0.13)" : "rgba(16,20,26,0.95)"}
        stroke={status === "winner" ? "#f59e0b" : "#1e2a38"}
        strokeWidth="0.75" rx="2" />);

      // Position number outside (game 1 only)
      if (game === 1) {
        els.push(<text key={`posn-${ci}`}
          x={posNumX} y={midY}
          textAnchor="end"
          dominantBaseline="central"
          fontSize="9" fill="#374151"
          fontFamily="'Barlow Condensed',Arial Narrow,Arial" fontWeight="700">
          {pos}
        </text>);
      }

      // Name
      if (name) {
        const maxChars = isHdcp ? 15 : 20;
        const dn = name.length > maxChars ? name.slice(0, maxChars - 1) + "…" : name;
        const nameY = isHdcp && score ? slotY + SLOT_H * 0.36 : midY;
        els.push(<text key={`name-${game}-${ci}`}
          x={colX + 6} y={nameY}
          dominantBaseline="central" fontSize="12"
          fill={status === "winner" ? "#f59e0b" : status === "lost" ? "#2d3748" : "#cbd5e1"}
          fontFamily="'Barlow Condensed',Arial Narrow,Arial"
          fontWeight={status === "winner" ? "700" : "400"}
          textDecoration={status === "lost" ? "line-through" : "none"}>
          {dn}
        </text>);
      }

      // Score
      if (score) {
        const { total, raw, hdcp } = score;
        const scoreY = isHdcp ? slotY + SLOT_H * 0.36 : midY;
        els.push(<text key={`total-${game}-${ci}`}
          x={colX + COL_W - 4} y={scoreY}
          textAnchor="end" dominantBaseline="central"
          fontSize="13"
          fill={status === "winner" ? "#f59e0b" : "#64748b"}
          fontFamily="'Barlow Condensed',Arial Narrow,Arial" fontWeight="800">
          {total}
        </text>);
        if (isHdcp && hdcp > 0) {
          els.push(<text key={`breakdown-${game}-${ci}`}
            x={colX + COL_W - 4} y={slotY + SLOT_H * 0.72}
            textAnchor="end" dominantBaseline="central"
            fontSize="8"
            fill={status === "winner" ? "rgba(245,158,11,0.55)" : "#374151"}
            fontFamily="'Barlow Condensed',Arial Narrow,Arial">
            {raw}+{hdcp}
          </text>);
        }
      }
    }
  }

  return <g>{els}</g>;
}

function Finals({ leftFinalists, rightFinalists, entryByPos, finalWinners, champion, xCenter, yOffset, getScore, isHdcp }) {
  const slotW = CENTER_W - 16;
  const slotX = xCenter - slotW / 2;
  const midY = yOffset + USABLE_H / 2;
  const gap = 10;
  const trophyH = 56;

  const renderSlot = (pos, y) => {
    const entry = entryByPos[pos];
    const isWinner = finalWinners.includes(pos) || champion === pos;
    const isLost = (finalWinners.length > 0 || champion) && !isWinner;
    const score = getScore(pos, 6);
    return (
      <g key={`final-${pos}`}>
        <rect x={slotX} y={y} width={slotW} height={SLOT_H}
          fill={isWinner ? "rgba(245,158,11,0.15)" : "rgba(16,20,26,0.95)"}
          stroke={isWinner ? "#f59e0b" : "#2a313d"}
          strokeWidth={isWinner ? "1.5" : "0.75"} rx="2" />
        <text x={slotX + 6} y={y + (isHdcp && score ? SLOT_H * 0.36 : SLOT_H / 2)}
          dominantBaseline="central" fontSize="12"
          fill={isWinner ? "#f59e0b" : isLost ? "#2d3748" : "#cbd5e1"}
          fontFamily="'Barlow Condensed',Arial Narrow,Arial"
          fontWeight={isWinner ? "700" : "400"}
          textDecoration={isLost ? "line-through" : "none"}>
          {entry?.bowler_name?.slice(0, 14) || "—"}
        </text>
        {score && <>
          <text x={slotX + slotW - 4} y={y + (isHdcp ? SLOT_H * 0.36 : SLOT_H / 2)}
            textAnchor="end" dominantBaseline="central"
            fontSize="13" fill={isWinner ? "#f59e0b" : "#64748b"}
            fontFamily="'Barlow Condensed',Arial Narrow,Arial" fontWeight="800">
            {score.total}
          </text>
          {isHdcp && score.hdcp > 0 && (
            <text x={slotX + slotW - 4} y={y + SLOT_H * 0.72}
              textAnchor="end" dominantBaseline="central"
              fontSize="8" fill={isWinner ? "rgba(245,158,11,0.55)" : "#374151"}
              fontFamily="'Barlow Condensed',Arial Narrow,Arial">
              {score.raw}+{score.hdcp}
            </text>
          )}
        </>}
      </g>
    );
  };

  const leftSlots = leftFinalists.map((pos, i) =>
    renderSlot(pos, midY - trophyH / 2 - gap - (leftFinalists.length - i) * (SLOT_H + gap))
  );
  const rightSlots = rightFinalists.map((pos, i) =>
    renderSlot(pos, midY + trophyH / 2 + gap + i * (SLOT_H + gap))
  );

  return (
    <g>
      {leftSlots}
      {rightSlots}
      <text x={xCenter} y={midY - 16} textAnchor="middle" fontSize="28" dominantBaseline="central">🏆</text>
      {champion ? (<>
        <text x={xCenter} y={midY + 10} textAnchor="middle"
          fontSize="10" fill="#f59e0b"
          fontFamily="'Barlow Condensed',Arial Narrow,Arial"
          fontWeight="800" letterSpacing="2">CHAMPION</text>
        <text x={xCenter} y={midY + 26} textAnchor="middle"
          fontSize="14" fill="#f59e0b"
          fontFamily="'Barlow Condensed',Arial Narrow,Arial" fontWeight="800">
          {entryByPos[champion]?.bowler_name?.slice(0, 16)}
        </text>
      </>) : (
        <text x={xCenter} y={midY + 14} textAnchor="middle"
          fontSize="9" fill="#374151"
          fontFamily="'Barlow Condensed',Arial Narrow,Arial">awaiting finalists</text>
      )}
    </g>
  );
}

function Screen({ color, children }) {
  return (
    <div style={{ background: "#0a0c0f", width: "100vw", height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "sans-serif", fontSize: "1.2rem", color }}>
      {children}
    </div>
  );
}
