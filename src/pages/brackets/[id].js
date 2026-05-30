import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/router";
import Head from "next/head";

const TOTAL_ROUNDS = 6;
const ROUND_LABELS = ["Gm 1", "Gm 2", "Gm 3", "Gm 4", "Gm 5", "Gm 6"];

// 1080p optimized layout constants
const DISPLAY_W = 1920;
const DISPLAY_H = 1080;
const HEADER_H = 44;
const PADDING = 8;
const USABLE_H = DISPLAY_H - HEADER_H - PADDING * 2;
const SLOT_H = 28;
const SLOT_GAP = 3;
const ROUND_LABEL_H = 24;
const CENTER_W = 180;
const COL_GAP = 8;
const HALF_W = (DISPLAY_W - CENTER_W - PADDING * 2) / 2;
const COL_W = Math.floor((HALF_W - 4 * COL_GAP) / 5);
const LINE_W = 10;

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

  if (loading) return (
    <div style={{ background: "#0a0c0f", color: "#94a3b8", display: "flex", alignItems: "center", justifyContent: "center", width: "100vw", height: "100vh", fontFamily: "sans-serif", fontSize: "1.2rem" }}>
      Loading bracket...
    </div>
  );

  if (!data) return (
    <div style={{ background: "#0a0c0f", color: "#ef4444", display: "flex", alignItems: "center", justifyContent: "center", width: "100vw", height: "100vh", fontFamily: "sans-serif" }}>
      Bracket not found.
    </div>
  );

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

  // Returns { total, hdcp, raw } or null
  const getScore = (pos, game) => {
    const e = entryByPos[pos];
    if (!e) return null;
    const raw = e.rawByGame?.[game];
    if (raw == null) return null;
    if (isHdcp) {
      const hdcp = e.handicap || 0;
      return { total: raw + hdcp, hdcp, raw };
    }
    return { total: raw, hdcp: 0, raw };
  };

  const winnersOf = (alive, game) => {
    if (!alive || alive.length === 0) return [];
    const key = alive.slice().sort((a, b) => a - b).join(",");
    return matchupMap[game]?.[key] || [];
  };

  const buildHalfSlots = (startPos) => {
    const half = Array.from({ length: 32 }, (_, i) => i + startPos);
    const rounds = [];
    for (let game = 1; game <= 5; game++) {
      const groupSize = Math.pow(2, game);
      const groups = [];
      for (let i = 0; i < 32; i += groupSize) {
        const positions = half.slice(i, i + groupSize);
        if (game === 1) {
          for (let j = 0; j < positions.length; j += 2) {
            const pair = positions.slice(j, j + 2);
            const winners = winnersOf(pair, 1);
            groups.push(pair.map(pos => ({
              pos,
              name: entryByPos[pos]?.bowler_name || "",
              score: getScore(pos, 1),
              status: winners.length > 0 ? (winners.includes(pos) ? "winner" : "lost") : "pending"
            })));
          }
        } else {
          const priorAlive = aliveAfter[game - 1];
          const alive = priorAlive ? positions.filter(p => priorAlive.has(p)) : [];
          const winners = winnersOf(alive, game);
          if (alive.length > 0) {
            groups.push(alive.map(pos => ({
              pos,
              name: entryByPos[pos]?.bowler_name || "",
              score: getScore(pos, game),
              status: winners.length > 0 ? (winners.includes(pos) ? "winner" : "lost") : "pending"
            })));
          } else {
            groups.push([{ pos: null, name: "", score: null, status: "empty" }]);
          }
        }
      }
      rounds.push(groups);
    }
    return rounds;
  };

  const leftRounds = buildHalfSlots(1);
  const rightRounds = buildHalfSlots(33);

  const leftFinalists = aliveAfter[5] ? [...aliveAfter[5]].filter(p => p <= 32) : [];
  const rightFinalists = aliveAfter[5] ? [...aliveAfter[5]].filter(p => p >= 33) : [];
  const allFinalists = [...leftFinalists, ...rightFinalists];
  const finalWinners = winnersOf(allFinalists, 6);
  const champion = aliveAfter[6]?.size === 1 ? [...aliveAfter[6]][0] : null;

  const svgH = USABLE_H + ROUND_LABEL_H + 4;
  const svgW = DISPLAY_W - PADDING * 2;

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
        {/* Header */}
        <div style={{
          height: HEADER_H,
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 1rem",
          background: "#111418",
          borderBottom: "2px solid #f59e0b",
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
            }}>
              {bracket.bracket_type}
            </span>
            {bracket.status === "active" && (
              <span style={{ display: "flex", alignItems: "center", gap: "0.3rem", fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.1em", color: "#10b981" }}>
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#10b981", display: "inline-block", animation: "pulse-dot 1.5s infinite" }} />
                LIVE
              </span>
            )}
            {isHdcp && (
              <span style={{ fontSize: "0.65rem", color: "#64748b", letterSpacing: "0.04em" }}>
                scores shown as total · handicap shown in brackets
              </span>
            )}
          </div>
          <div style={{ fontSize: "0.65rem", color: "#475569" }}>
            {entries.length}/64 entries{lastUpdate ? `  ·  updated ${lastUpdate.toLocaleTimeString()}` : ""}
          </div>
        </div>

        {/* SVG Bracket */}
        <div style={{ flex: 1, overflow: "hidden", padding: `${PADDING}px` }}>
          <svg
            width="100%"
            height="100%"
            viewBox={`0 0 ${svgW} ${svgH}`}
            preserveAspectRatio="xMidYMid meet"
            style={{ display: "block" }}
          >
            <defs>
              <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;600;700;800&display=swap');
                @keyframes pulse-dot { 0%,100%{opacity:1} 50%{opacity:.3} }
              `}</style>
            </defs>

            {/* Round labels — left */}
            {[0,1,2,3,4].map(i => (
              <text key={`ll${i}`}
                x={i * (COL_W + COL_GAP) + COL_W / 2}
                y={ROUND_LABEL_H / 2 + 4}
                textAnchor="middle" dominantBaseline="central"
                fontSize="12" fill="#64748b"
                fontFamily="'Barlow Condensed', Arial Narrow, Arial"
                fontWeight="700" letterSpacing="1.5"
              >
                {ROUND_LABELS[i].toUpperCase()}
              </text>
            ))}

            {/* Round labels — right */}
            {[0,1,2,3,4].map(i => (
              <text key={`rl${i}`}
                x={HALF_W + CENTER_W + COL_GAP + i * (COL_W + COL_GAP) + COL_W / 2}
                y={ROUND_LABEL_H / 2 + 4}
                textAnchor="middle" dominantBaseline="central"
                fontSize="12" fill="#64748b"
                fontFamily="'Barlow Condensed', Arial Narrow, Arial"
                fontWeight="700" letterSpacing="1.5"
              >
                {ROUND_LABELS[i].toUpperCase()}
              </text>
            ))}

            {/* Final label */}
            <text
              x={HALF_W + CENTER_W / 2}
              y={ROUND_LABEL_H / 2 + 4}
              textAnchor="middle" dominantBaseline="central"
              fontSize="12" fill="#f59e0b"
              fontFamily="'Barlow Condensed', Arial Narrow, Arial"
              fontWeight="800" letterSpacing="1.5"
            >
              {ROUND_LABELS[5].toUpperCase()} — FINAL
            </text>

            {/* Left half */}
            <HalfBracket
              rounds={leftRounds}
              side="left"
              xOffset={0}
              yOffset={ROUND_LABEL_H}
              bracketH={USABLE_H}
              isHdcp={isHdcp}
            />

            {/* Right half */}
            <HalfBracket
              rounds={rightRounds}
              side="right"
              xOffset={HALF_W + CENTER_W + COL_GAP}
              yOffset={ROUND_LABEL_H}
              bracketH={USABLE_H}
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
              yOffset={ROUND_LABEL_H}
              bracketH={USABLE_H}
              isHdcp={isHdcp}
              getScore={getScore}
            />
          </svg>
        </div>
      </div>
    </>
  );
}

function HalfBracket({ rounds, side, xOffset, yOffset, bracketH, isHdcp }) {
  const isRight = side === "right";
  const elements = [];

  rounds.forEach((groups, roundIdx) => {
    const game = roundIdx + 1;
    const colX = isRight
      ? xOffset + (4 - roundIdx) * (COL_W + COL_GAP)
      : xOffset + roundIdx * (COL_W + COL_GAP);

    const slotsPerGroup = Math.pow(2, game);
    const slotH = bracketH / 32; // based on 32 slots in game 1

    groups.forEach((group, gi) => {
      if (!group || group.length === 0) return;

      const groupSpan = slotsPerGroup * slotH;
      const groupTopY = yOffset + gi * groupSpan;
      const groupCenterY = groupTopY + groupSpan / 2;

      const totalGroupH = group.length * SLOT_H + Math.max(0, group.length - 1) * SLOT_GAP;
      const startY = groupCenterY - totalGroupH / 2;

      const connectorX = isRight ? colX + COL_W + LINE_W : colX - LINE_W;

      group.forEach((slot, si) => {
        if (!slot || slot.status === "empty") return;

        const slotY = startY + si * (SLOT_H + SLOT_GAP);
        const midY = slotY + SLOT_H / 2;
        const stubX1 = isRight ? colX + COL_W : colX;
        const stubX2 = connectorX;

        // Connector stub
        elements.push(
          <line key={`stub-${roundIdx}-${gi}-${si}`}
            x1={stubX1} y1={midY} x2={stubX2} y2={midY}
            stroke={slot.status === "winner" ? "#f59e0b" : "#1e2a38"}
            strokeWidth="1"
          />
        );

        // Slot background
        elements.push(
          <rect key={`bg-${roundIdx}-${gi}-${si}`}
            x={colX} y={slotY}
            width={COL_W} height={SLOT_H}
            fill={slot.status === "winner" ? "rgba(245,158,11,0.13)" : "rgba(16,20,26,0.95)"}
            stroke={slot.status === "winner" ? "#f59e0b" : "#1e2a38"}
            strokeWidth="0.75"
            rx="2"
          />
        );

        // Position number
        if (slot.pos) {
          elements.push(
            <text key={`pos-${roundIdx}-${gi}-${si}`}
              x={colX + 5} y={slotY + SLOT_H / 2}
              dominantBaseline="central"
              fontSize="10" fill="#374151"
              fontFamily="'Barlow Condensed', Arial Narrow, Arial"
              fontWeight="700"
            >
              {slot.pos}
            </text>
          );
        }

        // Name
        if (slot.name) {
          const maxChars = isHdcp ? 14 : 18;
          const displayName = slot.name.length > maxChars
            ? slot.name.slice(0, maxChars - 1) + "…"
            : slot.name;

          elements.push(
            <text key={`name-${roundIdx}-${gi}-${si}`}
              x={colX + 20} y={slotY + SLOT_H / 2}
              dominantBaseline="central"
              fontSize="12"
              fill={slot.status === "winner" ? "#f59e0b" : slot.status === "lost" ? "#2d3748" : "#cbd5e1"}
              fontFamily="'Barlow Condensed', Arial Narrow, Arial"
              fontWeight={slot.status === "winner" ? "700" : "400"}
              textDecoration={slot.status === "lost" ? "line-through" : "none"}
            >
              {displayName}
            </text>
          );
        }

        // Score
        if (slot.score) {
          const { total, hdcp } = slot.score;
          const scoreColor = slot.status === "winner" ? "#f59e0b" : "#64748b";

          // Total score
          elements.push(
            <text key={`score-${roundIdx}-${gi}-${si}`}
              x={colX + COL_W - (isHdcp ? 38 : 4)} y={slotY + SLOT_H / 2}
              textAnchor="end" dominantBaseline="central"
              fontSize="13"
              fill={scoreColor}
              fontFamily="'Barlow Condensed', Arial Narrow, Arial"
              fontWeight="800"
            >
              {total}
            </text>
          );

          // Handicap indicator
          if (isHdcp && hdcp > 0) {
            elements.push(
              <text key={`hdcp-${roundIdx}-${gi}-${si}`}
                x={colX + COL_W - 3} y={slotY + SLOT_H / 2}
                textAnchor="end" dominantBaseline="central"
                fontSize="8"
                fill={slot.status === "winner" ? "rgba(245,158,11,0.6)" : "#374151"}
                fontFamily="'Barlow Condensed', Arial Narrow, Arial"
                fontWeight="400"
              >
                +{hdcp}
              </text>
            );
          }
        }
      });

      // Vertical connector between slots in a group
      if (group.length > 1 && group[0].status !== "empty") {
        const topMidY = startY + SLOT_H / 2;
        const botMidY = startY + (group.length - 1) * (SLOT_H + SLOT_GAP) + SLOT_H / 2;
        elements.push(
          <line key={`vert-${roundIdx}-${gi}`}
            x1={connectorX} y1={topMidY}
            x2={connectorX} y2={botMidY}
            stroke="#1e2a38" strokeWidth="1"
          />
        );
      }

      // Game 1: horizontal connector to next round
      if (game === 1 && group.length === 2) {
        const nextColX = isRight
          ? colX + COL_W + LINE_W + COL_GAP
          : colX - LINE_W - COL_GAP;
        elements.push(
          <line key={`horiz-${roundIdx}-${gi}`}
            x1={connectorX} y1={groupCenterY}
            x2={nextColX} y2={groupCenterY}
            stroke="#1e2a38" strokeWidth="1"
          />
        );
      }
    });
  });

  return <g>{elements}</g>;
}

function Finals({ leftFinalists, rightFinalists, entryByPos, finalWinners, champion, xCenter, yOffset, bracketH, isHdcp, getScore }) {
  const slotW = CENTER_W - 20;
  const slotX = xCenter - slotW / 2;
  const midY = yOffset + bracketH / 2;
  const gap = 10;
  const trophyH = 50;

  const renderSlot = (pos, y) => {
    const entry = entryByPos[pos];
    const isWinner = finalWinners.includes(pos) || champion === pos;
    const isLost = (finalWinners.length > 0 || champion) && !isWinner;
    const score = getScore(pos, 6);

    return (
      <g key={`final-${pos}`}>
        <rect
          x={slotX} y={y} width={slotW} height={SLOT_H}
          fill={isWinner ? "rgba(245,158,11,0.15)" : "rgba(16,20,26,0.95)"}
          stroke={isWinner ? "#f59e0b" : "#2a313d"}
          strokeWidth={isWinner ? "1.5" : "0.75"}
          rx="2"
        />
        <text x={slotX + 5} y={y + SLOT_H / 2} dominantBaseline="central"
          fontSize="10" fill="#374151"
          fontFamily="'Barlow Condensed', Arial Narrow, Arial" fontWeight="700">
          {pos}
        </text>
        <text x={slotX + 20} y={y + SLOT_H / 2} dominantBaseline="central"
          fontSize="12"
          fill={isWinner ? "#f59e0b" : isLost ? "#2d3748" : "#cbd5e1"}
          fontFamily="'Barlow Condensed', Arial Narrow, Arial"
          fontWeight={isWinner ? "700" : "400"}
          textDecoration={isLost ? "line-through" : "none"}>
          {entry?.bowler_name?.slice(0, 14) || "—"}
        </text>
        {score && (
          <text x={slotX + slotW - 4} y={y + SLOT_H / 2} textAnchor="end" dominantBaseline="central"
            fontSize="13" fill={isWinner ? "#f59e0b" : "#64748b"}
            fontFamily="'Barlow Condensed', Arial Narrow, Arial" fontWeight="800">
            {score.total}
          </text>
        )}
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
      {champion ? (
        <>
          <text x={xCenter} y={midY + 10} textAnchor="middle"
            fontSize="10" fill="#f59e0b"
            fontFamily="'Barlow Condensed', Arial Narrow, Arial"
            fontWeight="800" letterSpacing="2">
            CHAMPION
          </text>
          <text x={xCenter} y={midY + 26} textAnchor="middle"
            fontSize="14" fill="#f59e0b"
            fontFamily="'Barlow Condensed', Arial Narrow, Arial"
            fontWeight="800">
            {entryByPos[champion]?.bowler_name?.slice(0, 16)}
          </text>
        </>
      ) : (
        <text x={xCenter} y={midY + 14} textAnchor="middle"
          fontSize="9" fill="#374151"
          fontFamily="'Barlow Condensed', Arial Narrow, Arial">
          awaiting finalists
        </text>
      )}
    </g>
  );
}
