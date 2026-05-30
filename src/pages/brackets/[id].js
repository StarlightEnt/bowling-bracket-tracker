import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/router";
import Head from "next/head";

const TOTAL_ROUNDS = 6;
const ROUND_LABELS = ["Gm 1", "Gm 2", "Gm 3", "Gm 4", "Gm 5", "Gm 6"];

// 1080p layout
const DISPLAY_W = 1920;
const DISPLAY_H = 1080;
const HEADER_H = 44;
const PADDING = 8;
const USABLE_H = DISPLAY_H - HEADER_H - PADDING * 2;
const ROUND_LABEL_H = 24;
const SLOT_H = 26;
const SLOT_GAP = 4;

// Position numbers sit OUTSIDE the bracket area with consistent spacing
const POS_W = 28;      // width of position number column
const POS_GAP = 6;     // gap between position number and cell

const CENTER_W = 180;
const COL_GAP = 24;    // gap between columns — bracket lines live here

// Each half = POS_W + POS_GAP + 5*COL_W + 4*COL_GAP
const HALF_W = (DISPLAY_W - CENTER_W - PADDING * 2) / 2;
const COL_W = Math.floor((HALF_W - POS_W - POS_GAP - 4 * COL_GAP) / 5);

// Vertical slot spacing — 32 slots fill USABLE_H
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

  const winnersOf = (alive, game) => {
    if (!alive || alive.length === 0) return [];
    const key = alive.slice().sort((a, b) => a - b).join(",");
    return matchupMap[game]?.[key] || [];
  };

  const leftFinalists = aliveAfter[5] ? [...aliveAfter[5]].filter(p => p <= 32) : [];
  const rightFinalists = aliveAfter[5] ? [...aliveAfter[5]].filter(p => p >= 33) : [];
  const allFinalists = [...leftFinalists, ...rightFinalists];
  const finalWinners = winnersOf(allFinalists, 6);
  const champion = aliveAfter[6]?.size === 1 ? [...aliveAfter[6]][0] : null;

  const svgW = DISPLAY_W - PADDING * 2;
  const svgH = USABLE_H + ROUND_LABEL_H + 4;

  // Left half: pos numbers on left edge, columns go right, bracket lines on RIGHT of each col
  // xOffset = where col 0 (Game1) starts = POS_W + POS_GAP
  const leftColsX = POS_W + POS_GAP;
  // Right half: pos numbers on right edge, columns go left (Game1 rightmost)
  // xOffset = where the right half starts
  const rightHalfX = HALF_W + CENTER_W + COL_GAP;
  // Right half Game1 col starts at: rightHalfX + 4*(COL_W+COL_GAP)
  // pos numbers are to the RIGHT of game1 col: rightHalfX + 5*(COL_W+COL_GAP) - COL_GAP + POS_GAP

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

            {/* Round labels left */}
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

            {/* Round labels right — Gm1 on far right, Gm5 closest to center */}
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

            {/* Final label */}
            <text x={HALF_W + CENTER_W / 2} y={ROUND_LABEL_H / 2 + 4}
              textAnchor="middle" dominantBaseline="central"
              fontSize="12" fill="#f59e0b"
              fontFamily="'Barlow Condensed',Arial Narrow,Arial"
              fontWeight="800" letterSpacing="1.5">
              {ROUND_LABELS[5].toUpperCase()} — FINAL
            </text>

            {/* Left half */}
            <BracketHalf
              startPos={1} side="left"
              colsX={leftColsX}
              posX={0}
              posAnchor="end"
              yOffset={ROUND_LABEL_H}
              entryByPos={entryByPos}
              aliveAfter={aliveAfter}
              winnersOf={winnersOf}
              getScore={getScore}
              isHdcp={isHdcp}
            />

            {/* Right half */}
            <BracketHalf
              startPos={33} side="right"
              colsX={rightHalfX}
              posX={rightHalfX + 5 * (COL_W + COL_GAP) - COL_GAP + POS_GAP}
              posAnchor="start"
              yOffset={ROUND_LABEL_H}
              entryByPos={entryByPos}
              aliveAfter={aliveAfter}
              winnersOf={winnersOf}
              getScore={getScore}
              isHdcp={isHdcp}
            />

            {/* Championship */}
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

function BracketHalf({ startPos, side, colsX, posX, posAnchor, yOffset, entryByPos, aliveAfter, winnersOf, getScore, isHdcp }) {
  const isRight = side === "right";
  const half = Array.from({ length: 32 }, (_, i) => i + startPos);
  const els = [];

  for (let game = 1; game <= 5; game++) {
    const groupSize = Math.pow(2, game);

    // Column X:
    // Left:  game1=col0 (leftmost),  game5=col4 (rightmost, closest to center)
    // Right: game1=col4 (rightmost), game5=col0 (leftmost,  closest to center)
    const colIdx = isRight ? (5 - game) : (game - 1);
    const colX = colsX + colIdx * (COL_W + COL_GAP);

    // The bracket line (vertical connector) lives in the GAP between this column
    // and the next column (which is toward center).
    // Left side:  next col is to the RIGHT => bracket line on RIGHT edge of cell = colX + COL_W
    // Right side: next col is to the LEFT  => bracket line on LEFT  edge of cell = colX
    const bracketX = isRight ? colX : colX + COL_W;

    // The stub goes from the FAR edge of the cell (away from center) to bracketX.
    // Left side:  far edge = left edge  = colX
    // Right side: far edge = right edge = colX + COL_W
    const stubStartX = isRight ? colX + COL_W : colX;

    // The feed line goes from bracketX across the gap to the bracket line of the NEXT column.
    // Next column's bracket line X:
    // Left side:  next colIdx = game, nextColX = colsX + game*(COL_W+COL_GAP), bracketX = nextColX
    // Right side: next colIdx = 5-(game+1)=4-game, nextColX = colsX+(4-game)*(COL_W+COL_GAP), bracketX = nextColX+COL_W
    const nextColIdx = isRight ? (4 - game) : game;
    const nextColX = colsX + nextColIdx * (COL_W + COL_GAP);
    const feedEndX = isRight ? nextColX + COL_W : nextColX;

    for (let gi = 0; gi < 32 / groupSize; gi++) {
      const positions = half.slice(gi * groupSize, (gi + 1) * groupSize);

      // Y span: based on exact pixel positions of the original game-1 slots
      const firstIdx = positions[0] - startPos;
      const lastIdx  = positions[positions.length - 1] - startPos;
      const groupTopY    = yOffset + firstIdx * SLOT_SPACING;
      const groupBotY    = yOffset + (lastIdx + 1) * SLOT_SPACING;
      const groupCenterY = (groupTopY + groupBotY) / 2;

      // Build slot list
      let slots = [];
      if (game === 1) {
        const winners = winnersOf(positions, 1);
        slots = positions.map(pos => ({
          pos,
          name: entryByPos[pos]?.bowler_name || "",
          score: getScore(pos, 1),
          status: winners.length > 0 ? (winners.includes(pos) ? "winner" : "lost") : "pending",
        }));
      } else {
        const priorAlive = aliveAfter[game - 1];
        const alive = priorAlive ? positions.filter(p => priorAlive.has(p)) : [];
        if (alive.length === 0) continue;
        const winners = winnersOf(alive, game);
        slots = alive.map(pos => ({
          pos,
          name: entryByPos[pos]?.bowler_name || "",
          score: getScore(pos, game),
          status: winners.length > 0 ? (winners.includes(pos) ? "winner" : "lost") : "pending",
        }));
      }
      if (slots.length === 0) continue;

      // Stack slots centered on groupCenterY
      const totalH = slots.length * SLOT_H + Math.max(0, slots.length - 1) * SLOT_GAP;
      const stackTopY = groupCenterY - totalH / 2;

      // --- BRACKET LINES (drawn behind cells) ---

      // 1. Vertical line connecting midpoints of top and bottom slots
      if (slots.length > 1) {
        const topMidY = stackTopY + SLOT_H / 2;
        const botMidY = stackTopY + (slots.length - 1) * (SLOT_H + SLOT_GAP) + SLOT_H / 2;
        els.push(<line key={`vert-${game}-${gi}`}
          x1={bracketX} y1={topMidY}
          x2={bracketX} y2={botMidY}
          stroke="#2a3545" strokeWidth="1.5" />);
      }

      // 2. Horizontal feed line from bracketX to next column's bracketX, at groupCenterY
      if (game < 5) {
        els.push(<line key={`feed-${game}-${gi}`}
          x1={bracketX} y1={groupCenterY}
          x2={feedEndX} y2={groupCenterY}
          stroke="#2a3545" strokeWidth="1.5" />);
      }

      // --- SLOTS ---
      slots.forEach((slot, si) => {
        const slotY = stackTopY + si * (SLOT_H + SLOT_GAP);
        const midY  = slotY + SLOT_H / 2;

        // Stub: from far edge of cell to bracketX
        els.push(<line key={`stub-${game}-${gi}-${si}`}
          x1={stubStartX} y1={midY}
          x2={bracketX}   y2={midY}
          stroke={slot.status === "winner" ? "#f59e0b" : "#1e2a38"} strokeWidth="1" />);

        // Cell background
        els.push(<rect key={`bg-${game}-${gi}-${si}`}
          x={colX} y={slotY} width={COL_W} height={SLOT_H}
          fill={slot.status === "winner" ? "rgba(245,158,11,0.13)" : "rgba(16,20,26,0.95)"}
          stroke={slot.status === "winner" ? "#f59e0b" : "#1e2a38"}
          strokeWidth="0.75" rx="2" />);

        // Position number (game 1 only, outside cell)
        if (game === 1) {
          els.push(<text key={`posn-${gi}-${si}`}
            x={isRight ? posX + POS_W : posX + POS_W - 2}
            y={midY}
            textAnchor={posAnchor}
            dominantBaseline="central"
            fontSize="9" fill="#374151"
            fontFamily="'Barlow Condensed',Arial Narrow,Arial" fontWeight="700">
            {slot.pos}
          </text>);
        }

        // Name
        if (slot.name) {
          const maxChars = isHdcp ? 15 : 20;
          const dn = slot.name.length > maxChars ? slot.name.slice(0, maxChars - 1) + "\u2026" : slot.name;
          const nameY = isHdcp && slot.score ? slotY + SLOT_H * 0.36 : midY;
          els.push(<text key={`name-${game}-${gi}-${si}`}
            x={colX + 6} y={nameY}
            dominantBaseline="central" fontSize="12"
            fill={slot.status === "winner" ? "#f59e0b" : slot.status === "lost" ? "#2d3748" : "#cbd5e1"}
            fontFamily="'Barlow Condensed',Arial Narrow,Arial"
            fontWeight={slot.status === "winner" ? "700" : "400"}
            textDecoration={slot.status === "lost" ? "line-through" : "none"}>
            {dn}
          </text>);
        }

        // Score
        if (slot.score) {
          const { total, raw, hdcp } = slot.score;
          const scoreY = isHdcp ? slotY + SLOT_H * 0.36 : midY;
          els.push(<text key={`total-${game}-${gi}-${si}`}
            x={colX + COL_W - 4} y={scoreY}
            textAnchor="end" dominantBaseline="central"
            fontSize="13"
            fill={slot.status === "winner" ? "#f59e0b" : "#64748b"}
            fontFamily="'Barlow Condensed',Arial Narrow,Arial" fontWeight="800">
            {total}
          </text>);
          if (isHdcp && hdcp > 0) {
            els.push(<text key={`breakdown-${game}-${gi}-${si}`}
              x={colX + COL_W - 4} y={slotY + SLOT_H * 0.72}
              textAnchor="end" dominantBaseline="central"
              fontSize="8"
              fill={slot.status === "winner" ? "rgba(245,158,11,0.55)" : "#374151"}
              fontFamily="'Barlow Condensed',Arial Narrow,Arial">
              {raw}+{hdcp}
            </text>);
          }
        }
      });
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
