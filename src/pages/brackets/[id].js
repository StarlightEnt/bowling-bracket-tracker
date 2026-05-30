import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/router";
import Head from "next/head";

const ROUND_LABELS = ["Gm 1", "Gm 2", "Gm 3", "Gm 4", "Gm 5", "Gm 6"];
const TOTAL_GAMES = 6;

// 1080p layout
const DISPLAY_W = 1920;
const DISPLAY_H = 1080;
const HEADER_H = 44;
const PADDING = 8;
const USABLE_H = DISPLAY_H - HEADER_H - PADDING * 2;
const ROUND_LABEL_H = 24;
const BRACKET_H = USABLE_H - ROUND_LABEL_H;
const SLOT_H = 24;
const STUB_LEN = 10;       // length of stub lines on each side of a cell
const CENTER_W = 180;      // championship column width
const POS_W = 24;          // position number width outside bracket
const POS_GAP = 4;
const NUM_COLS = 5;        // rounds per half (Gm1-Gm5)
const COL_GAP = STUB_LEN * 2; // gap between columns = 2 stubs meeting in the middle
const HALF_W = (DISPLAY_W - CENTER_W - PADDING * 2) / 2;
const COL_W = Math.floor((HALF_W - POS_W - POS_GAP - (NUM_COLS - 1) * COL_GAP) / NUM_COLS);

// 32 slots per half, each slot occupies BRACKET_H/32 vertical space
const SLOT_SPACING = BRACKET_H / 32;

// Y center of a half-bracket slot by its 0-based index (0-31)
const slotCenterY = (idx) => ROUND_LABEL_H + (idx + 0.5) * SLOT_SPACING;

// X position of a column by colIdx (0=outermost, 4=innermost toward center)
const colX = (colsX, colIdx) => colsX + colIdx * (COL_W + COL_GAP);

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
  for (let g = 1; g <= TOTAL_GAMES; g++) {
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

  // Left half: positions 1-32, col 0 = Gm1 (leftmost), col 4 = Gm5 (rightmost/innermost)
  const leftColsX = POS_W + POS_GAP;
  // Right half: positions 33-64, col 0 = Gm1 (rightmost), col 4 = Gm5 (leftmost/innermost)
  const rightColsX = HALF_W + CENTER_W + COL_GAP;

  const leftFinalists = aliveAfter[5] ? [...aliveAfter[5]].filter(p => p <= 32) : [];
  const rightFinalists = aliveAfter[5] ? [...aliveAfter[5]].filter(p => p >= 33) : [];
  const allFinalists = [...leftFinalists, ...rightFinalists];
  const finalWinners = winnersOf(allFinalists, 6);
  const champion = aliveAfter[6]?.size === 1 ? [...aliveAfter[6]][0] : null;

  const svgW = DISPLAY_W - PADDING * 2;
  const svgH = USABLE_H + 4;

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

            {/* Round labels */}
            {[0,1,2,3,4].map(i => (
              <text key={`ll${i}`}
                x={colX(leftColsX, i) + COL_W / 2} y={ROUND_LABEL_H / 2 + 2}
                textAnchor="middle" dominantBaseline="central"
                fontSize="11" fill="#64748b"
                fontFamily="'Barlow Condensed',Arial Narrow,Arial"
                fontWeight="700" letterSpacing="1.5">
                {ROUND_LABELS[i].toUpperCase()}
              </text>
            ))}
            {[0,1,2,3,4].map(i => (
              <text key={`rl${i}`}
                x={colX(rightColsX, 4 - i) + COL_W / 2} y={ROUND_LABEL_H / 2 + 2}
                textAnchor="middle" dominantBaseline="central"
                fontSize="11" fill="#64748b"
                fontFamily="'Barlow Condensed',Arial Narrow,Arial"
                fontWeight="700" letterSpacing="1.5">
                {ROUND_LABELS[i].toUpperCase()}
              </text>
            ))}
            <text x={HALF_W + CENTER_W / 2} y={ROUND_LABEL_H / 2 + 2}
              textAnchor="middle" dominantBaseline="central"
              fontSize="11" fill="#f59e0b"
              fontFamily="'Barlow Condensed',Arial Narrow,Arial"
              fontWeight="800" letterSpacing="1.5">
              {ROUND_LABELS[5].toUpperCase()} — FINAL
            </text>

            {/* Left half */}
            <BracketHalf
              startPos={1} side="left"
              colsX={leftColsX}
              posNumX={POS_W - 2}
              entryByPos={entryByPos}
              aliveAfter={aliveAfter}
              winnersOf={winnersOf}
              getScore={getScore}
              isHdcp={isHdcp}
            />

            {/* Right half */}
            <BracketHalf
              startPos={33} side="right"
              colsX={rightColsX}
              posNumX={rightColsX + NUM_COLS * (COL_W + COL_GAP) - COL_GAP + POS_GAP + POS_W - 2}
              entryByPos={entryByPos}
              aliveAfter={aliveAfter}
              winnersOf={winnersOf}
              getScore={getScore}
              isHdcp={isHdcp}
            />

            {/* Finals */}
            <Finals
              leftFinalists={leftFinalists}
              rightFinalists={rightFinalists}
              entryByPos={entryByPos}
              finalWinners={finalWinners}
              champion={champion}
              xCenter={HALF_W + CENTER_W / 2}
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

function BracketHalf({ startPos, side, colsX, posNumX, entryByPos, aliveAfter, winnersOf, getScore, isHdcp }) {
  const isRight = side === "right";
  const els = [];

  // For the right side, col 0 = Gm1 (rightmost), col 4 = Gm5 (leftmost toward center)
  // For the left side, col 0 = Gm1 (leftmost), col 4 = Gm5 (rightmost toward center)
  const getColX = (game) => {
    const colIdx = isRight ? (NUM_COLS - game) : (game - 1);
    return colX(colsX, colIdx);
  };

  // For a cell in game G at half-index hi (0-31):
  // The cell spans slots from (hi * 2^(G-1)) to (hi * 2^(G-1) + 2^(G-1) - 1)
  // Its vertical center = midpoint of that span
  const getCellCenterY = (game, hi) => {
    const span = Math.pow(2, game - 1);
    const firstSlot = hi * span;
    const lastSlot = firstSlot + span - 1;
    return (slotCenterY(firstSlot) + slotCenterY(lastSlot)) / 2;
  };

  // Draw the full bracket framework first (all cells + all lines)
  for (let game = 1; game <= NUM_COLS; game++) {
    const cx = getColX(game);
    const numCells = 32 / Math.pow(2, game - 1);

    // Left stub X and right stub X for cells in this column
    // Left side: inner (toward center) stub is on RIGHT, outer stub is on LEFT
    // Right side: inner (toward center) stub is on LEFT, outer stub is on RIGHT
    // "Outer" = away from center = Game 1 far edge
    // "Inner" = toward center = feeds next game
    const leftEdge = cx;
    const rightEdge = cx + COL_W;
    // Stub on inner side (connects to next game)
    const innerStubX = isRight ? leftEdge : rightEdge;
    // Stub on outer side (connects from prior game)  
    const outerStubX = isRight ? rightEdge : leftEdge;

    for (let hi = 0; hi < numCells; hi++) {
      const centerY = getCellCenterY(game, hi);
      const slotY = centerY - SLOT_H / 2;

      // Determine cell content
      const span = Math.pow(2, game - 1);
      const firstSlot = hi * span;
      const positions = Array.from({ length: span }, (_, i) => startPos + firstSlot + i);

      let pos = null;
      let status = "empty";
      let name = "";
      let score = null;

      if (game === 1) {
        pos = positions[0];
        // Find pair partner (odd/even pairing)
        const pairHi = hi % 2 === 0 ? hi + 1 : hi - 1;
        const pairPos = startPos + pairHi * span;
        const pair = [pos, pairPos].sort((a, b) => a - b);
        const winners = winnersOf(pair, 1);
        status = winners.length > 0 ? (winners.includes(pos) ? "winner" : "lost") : "pending";
        name = entryByPos[pos]?.bowler_name || "";
        score = getScore(pos, 1);
      } else {
        const priorAlive = aliveAfter[game - 1];
        if (priorAlive) {
          const alive = positions.filter(p => priorAlive.has(p));
          if (alive.length === 1) {
            pos = alive[0];
            const thisAlive = aliveAfter[game];
            status = thisAlive ? (thisAlive.has(pos) ? "winner" : "lost") : "pending";
            name = entryByPos[pos]?.bowler_name || "";
            score = getScore(pos, game);
          }
        }
      }

      const hasContent = pos !== null && name !== "";
      const winnerColor = "#f59e0b";
      const lostColor = "#2d3748";
      const pendingColor = "#cbd5e1";
      const emptyBorder = "#1a2332";
      const filledBorder = status === "winner" ? winnerColor : status === "lost" ? "#2a313d" : "#2a3d52";

      // Cell background
      els.push(<rect key={`cell-${game}-${hi}`}
        x={cx} y={slotY} width={COL_W} height={SLOT_H}
        fill={status === "winner" ? "rgba(245,158,11,0.1)" : hasContent ? "rgba(16,20,26,0.95)" : "rgba(10,14,20,0.5)"}
        stroke={hasContent ? filledBorder : emptyBorder}
        strokeWidth="0.75" rx="2" />);

      // OUTER stub (away from center) — not on game 1 far outer edge
      // Left side game 1: no left stub. Right side game 1: no right stub.
      const isOuterEdge = game === 1;
      if (!isOuterEdge) {
        els.push(<line key={`ostub-${game}-${hi}`}
          x1={outerStubX} y1={centerY}
          x2={isRight ? outerStubX + STUB_LEN : outerStubX - STUB_LEN} y2={centerY}
          stroke={hasContent ? filledBorder : emptyBorder} strokeWidth="1" />);
      }

      // INNER stub (toward center) — not on game 5 inner edge (those connect to finals)
      if (game < NUM_COLS) {
        els.push(<line key={`istub-${game}-${hi}`}
          x1={innerStubX} y1={centerY}
          x2={isRight ? innerStubX - STUB_LEN : innerStubX + STUB_LEN} y2={centerY}
          stroke={hasContent ? filledBorder : emptyBorder} strokeWidth="1" />);
      }

      // Position number outside bracket (game 1 only)
      if (game === 1) {
        els.push(<text key={`posn-${hi}`}
          x={posNumX} y={centerY}
          textAnchor="end" dominantBaseline="central"
          fontSize="9" fill="#2d3748"
          fontFamily="'Barlow Condensed',Arial Narrow,Arial" fontWeight="600">
          {pos || startPos + hi}
        </text>);
      }

      // Cell content
      if (hasContent) {
        const nameColor = status === "winner" ? winnerColor : status === "lost" ? lostColor : pendingColor;
        const maxChars = isHdcp ? 14 : 19;
        const dn = name.length > maxChars ? name.slice(0, maxChars - 1) + "…" : name;
        const nameY = isHdcp && score ? slotY + SLOT_H * 0.35 : centerY;

        els.push(<text key={`name-${game}-${hi}`}
          x={cx + 5} y={nameY}
          dominantBaseline="central" fontSize="11"
          fill={nameColor}
          fontFamily="'Barlow Condensed',Arial Narrow,Arial"
          fontWeight={status === "winner" ? "700" : "400"}
          textDecoration={status === "lost" ? "line-through" : "none"}>
          {dn}
        </text>);

        if (score) {
          const scoreY = isHdcp ? slotY + SLOT_H * 0.35 : centerY;
          els.push(<text key={`score-${game}-${hi}`}
            x={cx + COL_W - 4} y={scoreY}
            textAnchor="end" dominantBaseline="central"
            fontSize="12" fill={status === "winner" ? winnerColor : "#64748b"}
            fontFamily="'Barlow Condensed',Arial Narrow,Arial" fontWeight="800">
            {score.total}
          </text>);
          if (isHdcp && score.hdcp > 0) {
            els.push(<text key={`hdcp-${game}-${hi}`}
              x={cx + COL_W - 4} y={slotY + SLOT_H * 0.72}
              textAnchor="end" dominantBaseline="central"
              fontSize="8" fill={status === "winner" ? "rgba(245,158,11,0.5)" : "#2d3748"}
              fontFamily="'Barlow Condensed',Arial Narrow,Arial">
              {score.raw}+{score.hdcp}
            </text>);
          }
        }
      }
    }

    // Draw vertical bracket lines BETWEEN pairs of cells in this column
    // Each pair (hi=0&1, hi=2&3, ...) shares a vertical line between their inner stubs
    const numCellsInCol = 32 / Math.pow(2, game - 1);
    for (let pi = 0; pi < numCellsInCol; pi += 2) {
      const topCenterY = getCellCenterY(game, pi);
      const botCenterY = getCellCenterY(game, pi + 1);
      const vertX = isRight
        ? leftEdge - STUB_LEN
        : rightEdge + STUB_LEN;

      // Vertical line connecting the two inner stubs
      els.push(<line key={`vline-${game}-${pi}`}
        x1={vertX} y1={topCenterY}
        x2={vertX} y2={botCenterY}
        stroke="#1e2a38" strokeWidth="1.5" />);

      // Horizontal feed line from midpoint to next column's outer stub end
      if (game < NUM_COLS) {
        const feedY = (topCenterY + botCenterY) / 2;
        const nextCx = getColX(game + 1);
        const nextOuterStubEndX = isRight
          ? nextCx + COL_W + STUB_LEN
          : nextCx - STUB_LEN;
        els.push(<line key={`hline-${game}-${pi}`}
          x1={vertX} y1={feedY}
          x2={nextOuterStubEndX} y2={feedY}
          stroke="#1e2a38" strokeWidth="1.5" />);
      }
    }
  }

  return <g>{els}</g>;
}

function Finals({ leftFinalists, rightFinalists, entryByPos, finalWinners, champion, xCenter, getScore, isHdcp }) {
  const slotW = CENTER_W - 20;
  const slotX = xCenter - slotW / 2;
  const midY = ROUND_LABEL_H + BRACKET_H / 2;
  const trophySpace = 60;
  const slotGap = 12;

  const renderSlot = (pos, y) => {
    const entry = entryByPos[pos];
    const isWinner = finalWinners.includes(pos) || champion === pos;
    const isLost = (finalWinners.length > 0 || champion) && !isWinner;
    const score = getScore(pos, 6);
    const name = entry?.bowler_name || "—";

    return (
      <g key={`final-${pos}`}>
        <rect x={slotX} y={y} width={slotW} height={SLOT_H}
          fill={isWinner ? "rgba(245,158,11,0.12)" : "rgba(16,20,26,0.95)"}
          stroke={isWinner ? "#f59e0b" : "#2a3d52"}
          strokeWidth={isWinner ? "1.5" : "0.75"} rx="2" />
        <text x={slotX + 5} y={y + (isHdcp && score ? SLOT_H * 0.35 : SLOT_H / 2)}
          dominantBaseline="central" fontSize="11"
          fill={isWinner ? "#f59e0b" : isLost ? "#2d3748" : "#cbd5e1"}
          fontFamily="'Barlow Condensed',Arial Narrow,Arial"
          fontWeight={isWinner ? "700" : "400"}
          textDecoration={isLost ? "line-through" : "none"}>
          {name.slice(0, 14)}
        </text>
        {score && <>
          <text x={slotX + slotW - 4} y={y + (isHdcp ? SLOT_H * 0.35 : SLOT_H / 2)}
            textAnchor="end" dominantBaseline="central"
            fontSize="12" fill={isWinner ? "#f59e0b" : "#64748b"}
            fontFamily="'Barlow Condensed',Arial Narrow,Arial" fontWeight="800">
            {score.total}
          </text>
          {isHdcp && score.hdcp > 0 && (
            <text x={slotX + slotW - 4} y={y + SLOT_H * 0.72}
              textAnchor="end" dominantBaseline="central"
              fontSize="8" fill={isWinner ? "rgba(245,158,11,0.5)" : "#2d3748"}
              fontFamily="'Barlow Condensed',Arial Narrow,Arial">
              {score.raw}+{score.hdcp}
            </text>
          )}
        </>}
      </g>
    );
  };

  const leftSlots = leftFinalists.map((pos, i) =>
    renderSlot(pos, midY - trophySpace / 2 - slotGap - (leftFinalists.length - i) * (SLOT_H + slotGap))
  );
  const rightSlots = rightFinalists.map((pos, i) =>
    renderSlot(pos, midY + trophySpace / 2 + slotGap + i * (SLOT_H + slotGap))
  );

  return (
    <g>
      {leftSlots}
      {rightSlots}
      <text x={xCenter} y={midY - 14} textAnchor="middle" fontSize="26" dominantBaseline="central">🏆</text>
      {champion ? (<>
        <text x={xCenter} y={midY + 8} textAnchor="middle"
          fontSize="9" fill="#f59e0b"
          fontFamily="'Barlow Condensed',Arial Narrow,Arial"
          fontWeight="800" letterSpacing="2">CHAMPION</text>
        <text x={xCenter} y={midY + 23} textAnchor="middle"
          fontSize="13" fill="#f59e0b"
          fontFamily="'Barlow Condensed',Arial Narrow,Arial" fontWeight="800">
          {entryByPos[champion]?.bowler_name?.slice(0, 16)}
        </text>
      </>) : (
        <text x={xCenter} y={midY + 12} textAnchor="middle"
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
