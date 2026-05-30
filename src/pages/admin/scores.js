import { useState, useEffect, useRef } from "react";
import Layout from "../../components/Layout/Layout";
import { getAdminSession } from "../../utils/session.js";

export default function AdminScores() {
  const [gameNumber, setGameNumber] = useState(1);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [brackets, setBrackets] = useState([]);
  const fileRef = useRef();

  useEffect(() => {
    fetch("/api/public/brackets").then((r) => r.json()).then((d) => setBrackets(d.brackets || []));
  }, []);

  const handleImport = async (e) => {
    e.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file) return;
    setLoading(true);
    setResult(null);

    const fd = new FormData();
    fd.append("file", file);
    fd.append("game_number", gameNumber);

    const res = await fetch("/api/admin/import-scores", { method: "POST", body: fd });
    const data = await res.json();
    setResult({ ...data, ok: res.ok });
    setLoading(false);
    fileRef.current.value = "";

    // Refresh brackets
    fetch("/api/public/brackets").then((r) => r.json()).then((d) => setBrackets(d.brackets || []));
  };

  const [deleteResult, setDeleteResult] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const maxGame = brackets.reduce((m, b) => Math.max(m, b.current_game || 0), 0);

  const handleDelete = async (game) => {
    const label = game === "all" ? "ALL scores and results" : `Game ${game} scores`;
    if (!confirm(`Delete ${label}? This cannot be undone.`)) return;
    setDeleting(true);
    setDeleteResult(null);
    const res = await fetch("/api/admin/delete-scores", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ game_number: game }),
    });
    const data = await res.json();
    setDeleteResult({ ...data, ok: res.ok });
    setDeleting(false);
    fetch("/api/public/brackets").then((r) => r.json()).then((d) => setBrackets(d.brackets || []));
  };

  const activeBrackets = brackets.filter((b) => b.status === "active");

  return (
    <Layout isAdmin>
      <h1 className="page-title">Import <span>Scores</span></h1>
      <p className="page-subtitle">Upload a game CSV to record scores and advance all active brackets</p>

      <div style={{ display: "grid", gridTemplateColumns: "400px 1fr", gap: "1.5rem", alignItems: "stretch" }}>
        {/* Upload form */}
        <div className="card">
          <div className="card-title">📊 Upload Game CSV</div>

          <p style={{ fontSize: "0.85rem", color: "var(--color-text-muted)", marginBottom: "1rem" }}>
            Required columns: <code style={{ color: "var(--color-amber)" }}>Bowler name</code>,{" "}
            <code style={{ color: "var(--color-amber)" }}>Scratch</code>,{" "}
            <code style={{ color: "var(--color-amber)" }}>Game number</code>. Extra columns ignored.
          </p>

          <form onSubmit={handleImport}>
            <div className="form-group">
              <label>Game Number</label>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: "0.4rem" }}>
                {[1, 2, 3, 4, 5, 6].map((g) => (
                  <button
                    key={g}
                    type="button"
                    className={`btn ${gameNumber === g ? "btn-primary" : "btn-outline"}`}
                    style={{ padding: "0.5rem" }}
                    onClick={() => setGameNumber(g)}
                  >
                    {g}
                  </button>
                ))}
              </div>
              <div style={{ fontSize: "0.75rem", color: "var(--color-text-muted)", marginTop: "0.4rem" }}>
                {gameNumber === 6 ? "Championship round" : `Round of ${64 / Math.pow(2, gameNumber - 1)}`}
              </div>
            </div>

            <div className="form-group">
              <label>CSV File</label>
              <input type="file" accept=".csv" ref={fileRef} required />
            </div>

            {activeBrackets.length === 0 && (
              <div className="alert alert-info" style={{ marginBottom: "1rem" }}>
                No active brackets found. Activate brackets before importing scores.
              </div>
            )}

            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: "100%" }}
              disabled={loading || activeBrackets.length === 0}
            >
              {loading ? "Importing..." : `Import Game ${gameNumber} Scores`}
            </button>
          </form>

          {result && (
            <div className={`alert ${result.ok ? "alert-success" : "alert-error"}`} style={{ marginTop: "1rem" }}>
              {result.ok ? (
                <>
                  <strong>✓ Game {result.gameNumber} imported</strong>
                  <div style={{ marginTop: "0.25rem", fontSize: "0.85rem" }}>
                    {result.saved} scores saved · {result.unmatched?.length || 0} unmatched
                  </div>
                </>
              ) : (
                result.error
              )}

              {result.unmatched?.length > 0 && (
                <div style={{ marginTop: "0.75rem" }}>
                  <strong style={{ fontSize: "0.8rem" }}>Unmatched bowlers:</strong>
                  <ul style={{ margin: "0.25rem 0 0", paddingLeft: "1.2rem", fontSize: "0.8rem" }}>
                    {result.unmatched.map((u, i) => (
                      <li key={i}>{u.name} — {u.reason}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Bracket status */}
        <div className="card">
          <div className="card-title">Active Brackets</div>
          {activeBrackets.length === 0 ? (
            <p style={{ color: "var(--color-text-muted)" }}>
              No active brackets. Go to{" "}
              <a href="/admin/brackets">Brackets</a> and activate at least one.
            </p>
          ) : (
            <>
              <p style={{ fontSize: "0.85rem", color: "var(--color-text-muted)", marginBottom: "1rem" }}>
                Scores will be applied to all active brackets. Scratch brackets use raw scores;
                handicap brackets add each bowler's stored handicap.
              </p>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Bracket</th>
                    <th>Type</th>
                    <th>Entries</th>
                    <th>Current Game</th>
                  </tr>
                </thead>
                <tbody>
                  {activeBrackets.map((b) => (
                    <tr key={b.id}>
                      <td style={{ fontFamily: "var(--font-display)", fontWeight: 700, color: "var(--color-amber)" }}>
                        {b.name}
                      </td>
                      <td><span className={`badge badge-${b.bracket_type}`}>{b.bracket_type}</span></td>
                      <td>{b.entry_count} / 64</td>
                      <td>
                        {b.current_game > 0 ? (
                          <span style={{ color: "var(--color-handicap)" }}>Game {b.current_game} complete</span>
                        ) : (
                          <span style={{ color: "var(--color-text-muted)" }}>Not started</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          {/* Round guide */}
          <div style={{ marginTop: "1.5rem" }}>
            <div style={{ fontFamily: "var(--font-display)", fontSize: "0.75rem", letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--color-text-muted)", marginBottom: "0.75rem" }}>
              Round Guide
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.5rem" }}>
              {[
                { game: 1, label: "Round of 64", desc: "All 64 bowl" },
                { game: 2, label: "Round of 32", desc: "32 advance" },
                { game: 3, label: "Round of 16", desc: "16 advance" },
                { game: 4, label: "Elite 8",     desc: "8 advance" },
                { game: 5, label: "Final Four",  desc: "4 advance" },
                { game: 6, label: "Championship", desc: "2 compete" },
              ].map(({ game, label, desc }) => (
                <div
                  key={game}
                  style={{
                    padding: "0.6rem",
                    borderRadius: "var(--radius)",
                    background: gameNumber === game ? "rgba(245,158,11,0.12)" : "var(--color-surface-2)",
                    border: `1px solid ${gameNumber === game ? "var(--color-amber)" : "var(--color-border)"}`,
                  }}
                >
                  <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "0.8rem", color: gameNumber === game ? "var(--color-amber)" : "var(--color-text)" }}>
                    Game {game}
                  </div>
                  <div style={{ fontSize: "0.72rem", color: "var(--color-text-muted)" }}>{label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
        {/* Delete / Reset Scores */}
        <div className="card" style={{ marginTop: "1.5rem", borderColor: "rgba(239,68,68,0.3)" }}>
          <div className="card-title" style={{ color: "#ef4444" }}>⚠ Delete Scores</div>
          <p style={{ fontSize: "0.85rem", color: "var(--color-text-muted)", marginBottom: "1rem" }}>
            Remove scores in reverse order. You can only delete the most recently uploaded game.
            Use <strong>Full Reset</strong> to clear everything at once.
          </p>

          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "center" }}>
            {[6,5,4,3,2,1].map(g => {
              const hasScore = maxGame >= g;
              const canDelete = maxGame === g;
              return (
                <button key={g}
                  className="btn"
                  onClick={() => handleDelete(g)}
                  disabled={!hasScore || !canDelete || deleting}
                  style={{
                    background: canDelete ? "rgba(239,68,68,0.15)" : "transparent",
                    border: `1px solid ${hasScore ? (canDelete ? "#ef4444" : "#475569") : "#1e293b"}`,
                    color: hasScore ? (canDelete ? "#ef4444" : "#64748b") : "#1e293b",
                    cursor: canDelete ? "pointer" : "not-allowed",
                    opacity: hasScore ? 1 : 0.4,
                  }}
                >
                  Delete Gm {g}
                </button>
              );
            })}

            <div style={{ borderLeft: "1px solid #334155", paddingLeft: "0.75rem" }}>
              <button
                className="btn"
                onClick={() => handleDelete("all")}
                disabled={deleting || maxGame === 0}
                style={{
                  background: "rgba(239,68,68,0.2)",
                  border: "1px solid #ef4444",
                  color: "#ef4444",
                  fontWeight: 700,
                }}
              >
                {deleting ? "Deleting..." : "⚠ Full Reset"}
              </button>
            </div>
          </div>

          {deleteResult && (
            <div className={`alert ${deleteResult.ok ? "alert-success" : "alert-error"}`} style={{ marginTop: "1rem" }}>
              {deleteResult.ok ? `✓ ${deleteResult.message}` : `✗ ${deleteResult.error}`}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}

export const getServerSideProps = async ({ req }) => {
  const session = getAdminSession(req.headers.cookie || "");
  if (!session) return { redirect: { destination: "/admin/login", permanent: false } };
  return { props: {} };
};
