import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import Link from "next/link";
import { useSettings } from "../../utils/useSettings.js";

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
  const { settings } = useSettings();

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

  const { bracket, entries, matchups, prizes = [] } = data;
  const isHdcp = bracket.bracket_type === "handicap";
  const primaryColor = settings.primary_color || "#f59e0b";

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

  const svgW = DISPLAY_W;
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
          background: "#111418", borderBottom: `2px solid ${settings.primary_color || "#f59e0b"}`,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <Link href="/brackets" style={{
              display: "flex", alignItems: "center", gap: "0.3rem",
              fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.08em",
              textTransform: "uppercase", color: "#64748b", textDecoration: "none",
              padding: "0.25rem 0.5rem", borderRadius: "3px",
              border: "1px solid #1e293b", transition: "color 0.15s, border-color 0.15s",
            }}
              onMouseEnter={e => { e.currentTarget.style.color = "#94a3b8"; e.currentTarget.style.borderColor = "#334155"; }}
              onMouseLeave={e => { e.currentTarget.style.color = "#64748b"; e.currentTarget.style.borderColor = "#1e293b"; }}
            >
              ◀ Brackets
            </Link>
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
              {settings.tournament_logo_url ? (
                <img src={settings.tournament_logo_url} alt="" style={{ height: 30, maxWidth: 120, objectFit: "contain" }} />
              ) : (
                <span style={{ fontSize: "1.2rem" }}>🎳</span>
              )}
              <span style={{ fontSize: "1.1rem", fontWeight: 800, color: settings.primary_color || "#f59e0b", letterSpacing: "0.05em", textTransform: "uppercase" }}>
                {settings.tournament_name || "Bracket Tracker"}
              </span>
              <span style={{ fontSize: "0.8rem", color: "#64748b" }}>·</span>
              <span style={{ fontSize: "1.5rem", fontWeight: 800, color: settings.primary_color || "#f59e0b", letterSpacing: "0.05em", textTransform: "uppercase" }}>
                {bracket.name}
              </span>
            </div>
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
              fontSize="11" fill={primaryColor}
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
              primaryColor={primaryColor}
            />

            {/* Right half */}
            <BracketHalf
              startPos={33} side="right"
              colsX={rightColsX}
              posNumX={rightColsX + 4 * (COL_W + COL_GAP) + COL_W + POS_GAP}
              entryByPos={entryByPos}
              aliveAfter={aliveAfter}
              winnersOf={winnersOf}
              getScore={getScore}
              isHdcp={isHdcp}
              primaryColor={primaryColor}
            />

            {/* Finals */}
            <Finals
              leftFinalists={leftFinalists}
              rightFinalists={rightFinalists}
              entryByPos={entryByPos}
              finalWinners={finalWinners}
              champion={champion}
              xCenter={HALF_W + CENTER_W / 2}
              svgMid={svgW / 2}
              getScore={getScore}
              isHdcp={isHdcp}
              primaryColor={primaryColor}
              logoUrl={settings.tournament_logo_url}
              prizes={prizes}
            />
          </svg>
        </div>
        <style>{`@keyframes pulse-dot{0%,100%{opacity:1}50%{opacity:.3}}`}</style>
      </div>
    </>
  );
}

function BracketHalf({ startPos, side, colsX, posNumX, entryByPos, aliveAfter, winnersOf, getScore, isHdcp, primaryColor = "#f59e0b" }) {
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
      const winnerColor = primaryColor;
      const lostColor = "#2d3748";
      const pendingColor = "#cbd5e1";
      const emptyBorder = "#3d5068";
      const filledBorder = status === "winner" ? winnerColor : status === "lost" ? "#2a313d" : "#2a3d52";

      // Cell background
      els.push(<rect key={`cell-${game}-${hi}`}
        x={cx} y={slotY} width={COL_W} height={SLOT_H}
        fill={status === "winner" ? `${primaryColor}1a` : hasContent ? "rgba(16,20,26,0.95)" : "rgba(10,14,20,0.5)"}
        stroke={hasContent ? filledBorder : emptyBorder}
        strokeWidth="0.75" rx="2" />);

      // OUTER stub (away from center) — not on game 1 far outer edge
      // Left side game 1: no left stub. Right side game 1: no right stub.
      const isOuterEdge = game === 1;
      if (!isOuterEdge) {
        els.push(<line key={`ostub-${game}-${hi}`}
          x1={outerStubX} y1={centerY}
          x2={isRight ? outerStubX + STUB_LEN : outerStubX - STUB_LEN} y2={centerY}
          stroke={hasContent ? filledBorder : '#3d5068'} strokeWidth="1" />);
      }

      // INNER stub (toward center) — always draw, game 5 connects to finals
      if (true) {
        els.push(<line key={`istub-${game}-${hi}`}
          x1={innerStubX} y1={centerY}
          x2={isRight ? innerStubX - STUB_LEN : innerStubX + STUB_LEN} y2={centerY}
          stroke={hasContent ? filledBorder : '#3d5068'} strokeWidth="1" />);
      }

      // Position number outside bracket (game 1 only)
      if (game === 1) {
        els.push(<text key={`posn-${hi}`}
          x={posNumX} y={centerY}
          textAnchor={isRight ? "start" : "end"} dominantBaseline="central"
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
              fontSize="8" fill={status === "winner" ? `${primaryColor}80` : "#2d3748"}
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
        stroke="#3d5068" strokeWidth="1.5" />);

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
          stroke="#3d5068" strokeWidth="1.5" />);
      }
    }
  }

  return <g>{els}</g>;
}

function Finals({ leftFinalists, rightFinalists, entryByPos, finalWinners, champion, xCenter, svgMid, getScore, isHdcp, primaryColor = "#f59e0b", logoUrl, prizes = [] }) {
  // Finalist cell dimensions - same as rest of bracket
  const slotW = COL_W;
  const slotH = SLOT_H;

  // Left finalist cell:
  // - Positioned at the same Y as Game 4 cell covering slots 8-15 (Q1 second group of 8)
  // - This is vertically between the two Game 5 participants on the left side
  const leftCenterY = (slotCenterY(8) + slotCenterY(15)) / 2;
  const leftSlotY = leftCenterY - slotH / 2;

  // Right finalist cell:
  // - Positioned at the same Y as Game 4 cell covering slots 16-23 (right half, Q4 first group of 8)
  // - This is vertically between the two Game 5 participants on the right side
  const rightCenterY = (slotCenterY(16) + slotCenterY(23)) / 2;
  const rightSlotY = rightCenterY - slotH / 2;

  // Left finalist cell X: just to the right of Game 5 inner stub
  // Left half Game 5 col is colIdx=4: colX = leftColsX + 4*(COL_W+COL_GAP)
  const leftColsX = POS_W + POS_GAP;
  const leftG5colX = leftColsX + 4 * (COL_W + COL_GAP);
  const leftG5rightEdge = leftG5colX + COL_W;  // Game 5 right edge = inner stub base
  const leftCellX = leftG5rightEdge + COL_GAP; // finalist cell starts after the gap

  // Right finalist cell X: just to the left of Game 5 inner stub
  const rightColsX = HALF_W + CENTER_W + COL_GAP;
  const rightG5colX = rightColsX; // colIdx=0 for right side game 5 (innermost)
  const rightG5leftEdge = rightG5colX;
  const rightCellX = rightG5leftEdge - COL_GAP - slotW; // finalist cell ends before the gap

  // Game 5 vertical line X positions (inner stub ends)
  const leftVertX = leftG5rightEdge + STUB_LEN;   // end of left G5 inner stub
  const rightVertX = rightG5leftEdge - STUB_LEN;  // end of right G5 inner stub

  const leftPos = leftFinalists.length === 1 ? leftFinalists[0] : null;
  const rightPos = rightFinalists.length === 1 ? rightFinalists[0] : null;

  const renderFinalistCell = (pos, cellX, centerY, stubSide) => {
    const hasContent = pos !== null;
    const entry = hasContent ? entryByPos[pos] : null;
    const isWinner = hasContent && (finalWinners.includes(pos) || champion === pos);
    const isLost = hasContent && (finalWinners.length > 0 || champion) && !isWinner;
    const score = hasContent ? getScore(pos, 6) : null;
    const name = entry?.bowler_name || "";
    const borderColor = isWinner ? primaryColor : hasContent ? "#2a3d52" : "#3d5068";
    const cellY = centerY - slotH / 2;

    // Stub: left side has stub on LEFT, right side has stub on RIGHT
    const stubX1 = stubSide === "left" ? cellX : cellX + slotW;
    const stubX2 = stubSide === "left" ? cellX - STUB_LEN : cellX + slotW + STUB_LEN;

    return (
      <g key={`final-${stubSide}`}>
        <rect x={cellX} y={cellY} width={slotW} height={slotH}
          fill={isWinner ? `${primaryColor}1f` : hasContent ? "rgba(16,20,26,0.95)" : "rgba(10,14,20,0.5)"}
          stroke={borderColor} strokeWidth={isWinner ? "1.5" : "0.75"} rx="2" />
        {/* Single stub connecting to Game 5 vertical line */}
        <line x1={stubX1} y1={centerY} x2={stubX2} y2={centerY}
          stroke={borderColor} strokeWidth="1" />
        {hasContent && name && (
          <text x={cellX + 5} y={cellY + (isHdcp && score ? slotH * 0.35 : slotH / 2)}
            dominantBaseline="central" fontSize="11"
            fill={isWinner ? primaryColor : isLost ? "#2d3748" : "#cbd5e1"}
            fontFamily="'Barlow Condensed',Arial Narrow,Arial"
            fontWeight={isWinner ? "700" : "400"}
            textDecoration={isLost ? "line-through" : "none"}>
            {name.slice(0, 14)}
          </text>
        )}
        {score && <>
          <text x={cellX + slotW - 4} y={cellY + (isHdcp ? slotH * 0.35 : slotH / 2)}
            textAnchor="end" dominantBaseline="central"
            fontSize="12" fill={isWinner ? primaryColor : "#64748b"}
            fontFamily="'Barlow Condensed',Arial Narrow,Arial" fontWeight="800">
            {score.total}
          </text>
          {isHdcp && score.hdcp > 0 && (
            <text x={cellX + slotW - 4} y={cellY + slotH * 0.72}
              textAnchor="end" dominantBaseline="central"
              fontSize="8" fill={isWinner ? `${primaryColor}80` : "#2d3748"}
              fontFamily="'Barlow Condensed',Arial Narrow,Arial">
              {score.raw}+{score.hdcp}
            </text>
          )}
        </>}
      </g>
    );
  };

  const midY = ROUND_LABEL_H + BRACKET_H / 2;

  // Layout constants for center column
  const logoSize = 150;
  const logoTop = midY - logoSize / 2;    // 447
  const logoBottom = midY + logoSize / 2; // 597
  const topStart = ROUND_LABEL_H;
  const boxW = Math.round((CENTER_W - 16) * 1.5);  // 50% wider than original
  const boxX = svgMid - boxW / 2;

  // Top 2 prizes above logo, remaining below
  const topPrizes = prizes.slice(0, 2);
  const botPrizes = prizes.slice(2);
  const prizeBoxH = 78;  // 52 * 1.5 — top boxes
  const prizeGap = 12;
  const prizeBlockTop = ROUND_LABEL_H + BRACKET_H / 32;

  // Bottom prizes — original size, start at Gm2 winner of slots 24-25
  const botBoxH = 52;
  const botGap = 8;
  const botBlockTop = ROUND_LABEL_H + (24 + 0.5) * (BRACKET_H / 32) - SLOT_H / 2; // top of slot 25 box

  // Resolve winner names by place finish
  // place 1 = champion, place 2 = finalist losers, place 3 = semi-final losers
  const winnerByPlace = {};
  if (champion) winnerByPlace[1] = entryByPos[champion]?.bowler_name;
  if (finalWinners.length > 0 && champion) {
    const runnerUp = finalWinners.find(p => p !== champion);
    if (runnerUp) winnerByPlace[2] = entryByPos[runnerUp]?.bowler_name;
  }

  return (
    <g>
      {/* Left finalist cell with left stub */}
      {renderFinalistCell(leftPos, leftCellX, leftCenterY, "left")}
      {/* Right finalist cell with right stub */}
      {renderFinalistCell(rightPos, rightCellX, rightCenterY, "right")}

      {/* Prize boxes — top whitespace, one box per place */}
      {topPrizes.map((prize, i) => {
        const boxH = prizeBoxH;
        const rowH = boxH / 2;
        const py = prizeBlockTop + i * (boxH + prizeGap);
        const winnerName = winnerByPlace[prize.place];
        return (
          <g key={prize.place}>
            {/* Outer border */}
            <rect x={boxX} y={py} width={boxW} height={boxH}
              fill="none" stroke="#334155" strokeWidth="1" rx="3" />
            {/* Divider between top and bottom row */}
            <line x1={boxX} y1={py + rowH} x2={boxX + boxW} y2={py + rowH}
              stroke="#334155" strokeWidth="0.5" />
            {/* Top row: label left, amount right */}
            <text x={boxX + 12} y={py + rowH / 2}
              dominantBaseline="middle"
              fontSize="15" fontWeight="700" letterSpacing="0.05em"
              fontFamily="'Barlow Condensed',Arial Narrow,Arial"
              fill="#94a3b8">
              {prize.label}
            </text>
            <text x={boxX + boxW - 12} y={py + rowH / 2}
              dominantBaseline="middle" textAnchor="end"
              fontSize="20" fontWeight="800"
              fontFamily="'Barlow Condensed',Arial Narrow,Arial"
              fill={primaryColor}>
              ${Number(prize.amount).toLocaleString()}
            </text>
            {/* Bottom row: winner name centered */}
            <text x={svgMid} y={py + rowH + rowH / 2}
              dominantBaseline="middle" textAnchor="middle"
              fontSize={winnerName ? "21" : "11"} fontWeight="800"
              fontFamily="'Barlow Condensed',Arial Narrow,Arial"
              fill={winnerName ? primaryColor : "#1e3a5f"}>
              {winnerName || "awaiting result"}
            </text>
          </g>
        );
      })}

      {/* Tournament logo — dead center of window */}
      {logoUrl && (() => {
        const logoSize = 150;
        const logoW = logoSize;
        const lx = svgMid - logoW / 2;
        const ly = midY - logoSize / 2;
        return (
          <g>
            <defs>
              <clipPath id="logo-clip">
                <rect x={lx} y={ly} width={logoW} height={logoSize} />
              </clipPath>
            </defs>
            <image
              href={logoUrl}
              x={lx}
              y={ly}
              width={logoW}
              height={logoSize}
              preserveAspectRatio="xMidYMid meet"
              clipPath="url(#logo-clip)"
              opacity="0.9"
            />
          </g>
        );
      })()}

      {/* Bottom prize boxes — 3rd place and beyond, original size */}
      {botPrizes.map((prize, i) => {
        const boxH = botBoxH;
        const rowH = boxH / 2;
        const py = botBlockTop + i * (boxH + botGap);
        const winnerName = winnerByPlace[prize.place];
        return (
          <g key={`bot-${prize.place}`}>
            <rect x={boxX} y={py} width={boxW} height={boxH}
              fill="none" stroke="#334155" strokeWidth="1" rx="3" />
            <line x1={boxX} y1={py + rowH} x2={boxX + boxW} y2={py + rowH}
              stroke="#334155" strokeWidth="0.5" />
            <text x={boxX + 12} y={py + rowH / 2}
              dominantBaseline="middle"
              fontSize="10" fontWeight="700" letterSpacing="0.05em"
              fontFamily="'Barlow Condensed',Arial Narrow,Arial"
              fill="#94a3b8">
              {prize.label}
            </text>
            <text x={boxX + boxW - 12} y={py + rowH / 2}
              dominantBaseline="middle" textAnchor="end"
              fontSize="13" fontWeight="800"
              fontFamily="'Barlow Condensed',Arial Narrow,Arial"
              fill={primaryColor}>
              ${Number(prize.amount).toLocaleString()}
            </text>
            <text x={svgMid} y={py + rowH + rowH / 2}
              dominantBaseline="middle" textAnchor="middle"
              fontSize={winnerName ? "14" : "8"} fontWeight="800"
              fontFamily="'Barlow Condensed',Arial Narrow,Arial"
              fill={winnerName ? primaryColor : "#1e3a5f"}>
              {winnerName || "awaiting result"}
            </text>
          </g>
        );
      })}

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
