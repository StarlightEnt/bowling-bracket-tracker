import { useState, useEffect } from "react";
import Layout from "../../components/Layout/Layout";
import { getAdminSession } from "../../utils/session.js";

export default function AdminBrackets() {
  const [brackets, setBrackets] = useState([]);
  const [form, setForm] = useState({ name: "", bracket_type: "scratch" });
  const [msg, setMsg] = useState(null);

  const fetchBrackets = async () => {
    const res = await fetch("/api/admin/brackets");
    const data = await res.json();
    setBrackets(data.brackets || []);
  };

  useEffect(() => { fetchBrackets(); }, []);

  // Auto-suggest name based on type
  const suggestName = (type) => {
    const prefix = type === "scratch" ? "SB" : "HB";
    const existing = brackets.filter((b) => b.bracket_type === type).length;
    return `${prefix}${existing + 1}`;
  };

  const handleTypeChange = (type) => {
    setForm({ bracket_type: type, name: suggestName(type) });
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setMsg(null);
    const res = await fetch("/api/admin/brackets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    if (res.ok) {
      setMsg({ type: "success", text: `Bracket ${data.bracket.name} created` });
      setForm({ name: "", bracket_type: "scratch" });
      fetchBrackets();
    } else {
      setMsg({ type: "error", text: data.error });
    }
  };

  const handleStatusChange = async (id, status) => {
    await fetch(`/api/admin/brackets?id=${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    fetchBrackets();
  };

  const handleDelete = async (id, name) => {
    if (!confirm(`Delete bracket ${name}? This will remove all entries.`)) return;
    await fetch(`/api/admin/brackets?id=${id}`, { method: "DELETE" });
    fetchBrackets();
  };

  return (
    <Layout isAdmin>
      <h1 className="page-title">Manage <span>MegaBrackets</span></h1>
      <p className="page-subtitle">Create scratch (SB) and handicap (HB) brackets</p>

      <div style={{ display: "grid", gridTemplateColumns: "340px 1fr", gap: "1.5rem", alignItems: "start" }}>
        {/* Create form */}
        <div className="card">
          <div className="card-title">➕ New MegaBracket</div>
          <form onSubmit={handleCreate}>
            <div className="form-group">
              <label>MegaBracket Type</label>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                {["scratch", "handicap"].map((t) => (
                  <button
                    key={t}
                    type="button"
                    className={`btn ${form.bracket_type === t ? "btn-primary" : "btn-outline"}`}
                    style={{ flex: 1 }}
                    onClick={() => handleTypeChange(t)}
                  >
                    {t === "scratch" ? "Scratch" : "Handicap"}
                  </button>
                ))}
              </div>
            </div>
            <div className="form-group">
              <label>MegaBracket Name</label>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value.toUpperCase() })}
                placeholder={form.bracket_type === "scratch" ? "SB1" : "HB1"}
                required
              />
              <div style={{ fontSize: "0.75rem", color: "var(--color-text-muted)", marginTop: "0.3rem" }}>
                Format: SB1, SB2 for scratch · HB1, HB2 for handicap
              </div>
            </div>
            {msg && <div className={`alert alert-${msg.type}`}>{msg.text}</div>}
            <button type="submit" className="btn btn-primary" style={{ width: "100%" }}>
              Create MegaBracket
            </button>
          </form>
        </div>

        {/* Brackets list */}
        <div className="card">
          <div className="card-title">All MegaBrackets ({brackets.length})</div>
          {brackets.length === 0 ? (
            <p style={{ color: "var(--color-text-muted)" }}>No brackets yet.</p>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Type</th>
                  <th>Entries</th>
                  <th>Game</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {brackets.map((b) => (
                  <tr key={b.id}>
                    <td style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "1.1rem", color: "var(--color-amber)" }}>{b.name}</td>
                    <td><span className={`badge badge-${b.bracket_type}`}>{b.bracket_type}</span></td>
                    <td>{b.entry_count || 0} / 64</td>
                    <td>{b.current_game > 0 ? `Game ${b.current_game}` : "—"}</td>
                    <td><span className={`badge badge-${b.status}`}>{b.status}</span></td>
                    <td>
                      <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
                        {b.status === "setup" && (
                          <button className="btn btn-sm btn-outline" onClick={() => handleStatusChange(b.id, "active")}>
                            Activate
                          </button>
                        )}
                        {b.status === "active" && (
                          <button className="btn btn-sm btn-outline" onClick={() => handleStatusChange(b.id, "complete")}>
                            Complete
                          </button>
                        )}
                        <button className="btn btn-sm btn-danger" onClick={() => handleDelete(b.id, b.name)}>
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
