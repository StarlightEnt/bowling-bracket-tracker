import { useState, useEffect } from "react";
import Layout from "../../components/Layout/Layout";
import { getAdminSession } from "../../utils/session.js";

const QUADRANT_RANGES = {
  1: { start: 1,  end: 16,  label: "Q1 (1–16)"  },
  2: { start: 17, end: 32,  label: "Q2 (17–32)" },
  3: { start: 33, end: 48,  label: "Q3 (33–48)" },
  4: { start: 49, end: 64,  label: "Q4 (49–64)" },
};

export default function AdminChipDraw() {
  const [brackets, setBrackets] = useState([]);
  const [bowlers, setBowlers] = useState([]);
  const [selectedBracket, setSelectedBracket] = useState(null);
  const [selectedQuadrant, setSelectedQuadrant] = useState(1);
  const [entries, setEntries] = useState([]);
  const [selectedPos, setSelectedPos] = useState(null);
  const [selectedBowler, setSelectedBowler] = useState("");
  const [msg, setMsg] = useState(null);
  const [autoMsg, setAutoMsg] = useState(null);
  const [autoLoading, setAutoLoading] = useState(false);

  useEffect(() => {
    fetch("/api/admin/brackets").then((r) => r.json()).then((d) => setBrackets(d.brackets || []));
    fetch("/api/admin/bowlers").then((r) => r.json()).then((d) => setBowlers(d.bowlers || []));
  }, []);

  const fetchEntries = async (bracketId) => {
    const res = await fetch(`/api/admin/entries?bracket_id=${bracketId}`);
    const data = await res.json();
    setEntries(data.entries || []);
  };

  const handleBracketSelect = (bracket) => {
    setSelectedBracket(bracket);
    setSelectedPos(null);
    setSelectedBowler("");
    setMsg(null);
    setAutoMsg(null);
    fetchEntries(bracket.id);
  };

  const handleAutoDraw = async () => {
    if (!selectedBracket) return;
    if (!confirm(`Randomly assign all available bowlers to open slots in ${selectedBracket.name}?`)) return;
    setAutoLoading(true);
    setAutoMsg(null);
    const res = await fetch("/api/admin/auto-draw", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bracket_id: selectedBracket.id }),
    });
    const data = await res.json();
    if (res.ok) {
      setAutoMsg({ type: "success", text: `Assigned ${data.assigned} bowlers randomly!` });
      fetchEntries(selectedBracket.id);
    } else {
      setAutoMsg({ type: "error", text: data.error });
    }
    setAutoLoading(false);
  };

  const handleSlotClick = (pos) => {
    const taken = entries.find((e) => e.position === pos);
    if (taken) return;
    setSelectedPos(pos);
    setSelectedBowler("");
    setMsg(null);
  };

  const handleAssign = async () => {
    if (!selectedPos || !selectedBowler) return;
    setMsg(null);
    const res = await fetch("/api/admin/entries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        bracket_id: selectedBracket.id,
        bowler_id: selectedBowler,
        position: selectedPos,
      }),
    });
    const data = await res.json();
    if (res.ok) {
      setMsg({ type: "success", text: `Position ${selectedPos} assigned!` });
      setSelectedPos(null);
      setSelectedBowler("");
      fetchEntries(selectedBracket.id);
    } else {
      setMsg({ type: "error", text: data.error });
    }
  };

  const handleRemoveEntry = async (entryId, pos) => {
    if (!confirm(`Remove bowler from position ${pos}?`)) return;
    await fetch(`/api/admin/entries?id=${entryId}`, { method: "DELETE" });
    fetchEntries(selectedBracket.id);
  };

  const handleClearAll = async () => {
    if (!confirm(`Remove ALL entries from ${selectedBracket.name}? This cannot be undone.`)) return;
    for (const entry of entries) {
      await fetch(`/api/admin/entries?id=${entry.id}`, { method: "DELETE" });
    }
    fetchEntries(selectedBracket.id);
    setAutoMsg(null);
  };

  const entryByPos = {};
  entries.forEach((e) => { entryByPos[e.position] = e; });

  const range = QUADRANT_RANGES[selectedQuadrant];
  const slots = [];
  for (let p = range.start; p <= range.end; p++) slots.push(p);
  const openSlots = slots.filter((p) => !entryByPos[p]);

  return (
    <Layout isAdmin>
      <h1 className="page-title">Chip <span>Draw</span></h1>
      <p className="page-subtitle">Assign bowlers to bracket positions by quadrant</p>

      {/* Step 1: Select bracket */}
      <div className="card">
        <div className="card-title">Step 1 — Select MegaBracket</div>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          {brackets.map((b) => (
            <button
              key={b.id}
              className={`btn ${selectedBracket?.id === b.id ? "btn-primary" : "btn-outline"}`}
              onClick={() => handleBracketSelect(b)}
            >
              {b.name}
              <span className={`badge badge-${b.bracket_type}`} style={{ marginLeft: "0.4rem" }}>
                {b.bracket_type === "scratch" ? "S" : "H"}
              </span>
            </button>
          ))}
        </div>
        {brackets.length === 0 && (
          <p style={{ color: "var(--color-text-muted)", marginTop: "0.5rem" }}>
            No brackets yet. Create brackets first.
          </p>
        )}
      </div>

      {selectedBracket && (
        <>
          {/* Auto-fill card */}
          <div className="card" style={{ background: "var(--color-surface-2)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "1rem" }}>
              <div>
                <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "0.9rem", color: "var(--color-amber)" }}>
                  🎱 Auto-Fill Chip Draw
                </div>
                <div style={{ fontSize: "0.8rem", color: "var(--color-text-muted)", marginTop: "0.2rem" }}>
                  Randomly assigns all available bowlers to open slots in {selectedBracket.name}
                </div>
              </div>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                {entries.length > 0 && (
                  <button className="btn btn-danger" onClick={handleClearAll}>
                    Clear All
                  </button>
                )}
                <button
                  className="btn btn-primary"
                  onClick={handleAutoDraw}
                  disabled={autoLoading || entries.length >= 64}
                >
                  {autoLoading ? "Assigning..." : entries.length >= 64 ? "MegaBracket Full" : "Auto-Fill All Slots"}
                </button>
              </div>
            </div>
            {autoMsg && (
              <div className={`alert alert-${autoMsg.type}`} style={{ marginTop: "0.75rem" }}>
                {autoMsg.text}
              </div>
            )}
          </div>

          {/* Step 2: Select quadrant */}
          <div className="card">
            <div className="card-title">Step 2 — Select Quadrant</div>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              {[1, 2, 3, 4].map((q) => {
                const qRange = QUADRANT_RANGES[q];
                const filled = entries.filter((e) => e.position >= qRange.start && e.position <= qRange.end).length;
                return (
                  <button
                    key={q}
                    className={`btn ${selectedQuadrant === q ? "btn-primary" : "btn-outline"}`}
                    onClick={() => { setSelectedQuadrant(q); setSelectedPos(null); }}
                  >
                    {qRange.label} <span style={{ opacity: 0.6, fontWeight: 400 }}>({filled}/16)</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Step 3: Slot grid */}
          <div className="card">
            <div className="card-title">
              Step 3 — {selectedBracket.name} · {QUADRANT_RANGES[selectedQuadrant].label}
              <span style={{ fontWeight: 400, color: "var(--color-text-muted)", marginLeft: "0.75rem", fontSize: "0.8rem" }}>
                {openSlots.length} open slots
              </span>
            </div>
            <div className="chip-grid">
              {slots.map((pos) => {
                const entry = entryByPos[pos];
                const isTaken = Boolean(entry);
                const isSelected = selectedPos === pos;

                return (
                  <div
                    key={pos}
                    className={`chip-slot ${isTaken ? "taken" : "open"}`}
                    onClick={() => !isTaken && handleSlotClick(pos)}
                    style={isSelected ? { borderColor: "var(--color-amber)", background: "rgba(245,158,11,0.15)", color: "var(--color-amber)" } : {}}
                  >
                    <span className="chip-pos">{pos}</span>
                    {entry && <span className="chip-name">{entry.bowler_name}</span>}
                    {!entry && isSelected && <span className="chip-name">← select</span>}
                  </div>
                );
              })}
            </div>

            {/* Assign panel */}
            {selectedPos && (
              <div style={{
                marginTop: "1rem",
                padding: "1rem",
                background: "var(--color-surface-2)",
                borderRadius: "var(--radius)",
                border: "1px solid var(--color-amber)"
              }}>
                <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, marginBottom: "0.5rem" }}>
                  Assign bowler to position {selectedPos}
                </div>
                <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                  <select
                    value={selectedBowler}
                    onChange={(e) => setSelectedBowler(e.target.value)}
                    style={{ flex: 1 }}
                  >
                    <option value="">— Select bowler —</option>
                    {bowlers.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name} (avg {b.avg}, hdcp {b.handicap})
                      </option>
                    ))}
                  </select>
                  <button className="btn btn-primary" onClick={handleAssign} disabled={!selectedBowler}>
                    Assign
                  </button>
                  <button className="btn btn-outline" onClick={() => { setSelectedPos(null); setSelectedBowler(""); }}>
                    Cancel
                  </button>
                </div>
                {msg && <div className={`alert alert-${msg.type}`} style={{ marginTop: "0.75rem" }}>{msg.text}</div>}
              </div>
            )}
          </div>

          {/* Current entries table */}
          {entries.length > 0 && (
            <div className="card">
              <div className="card-title">
                Current Assignments — {selectedBracket.name} ({entries.length} / 64)
              </div>
              <table className="data-table">
                <thead>
                  <tr><th>Pos</th><th>Quadrant</th><th>Bowler</th><th>Avg</th><th>Handicap</th><th></th></tr>
                </thead>
                <tbody>
                  {entries.map((e) => (
                    <tr key={e.id}>
                      <td style={{ fontFamily: "var(--font-display)", fontWeight: 700 }}>{e.position}</td>
                      <td>Q{e.quadrant}</td>
                      <td>{e.bowler_name}</td>
                      <td>{e.avg}</td>
                      <td style={{ color: "var(--color-handicap)" }}>{e.handicap}</td>
                      <td>
                        <button className="btn btn-sm btn-danger" onClick={() => handleRemoveEntry(e.id, e.position)}>
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </Layout>
  );
}

export const getServerSideProps = async ({ req }) => {
  const session = getAdminSession(req.headers.cookie || "");
  if (!session) return { redirect: { destination: "/admin/login", permanent: false } };
  return { props: {} };
};
