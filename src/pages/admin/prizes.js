import { useState, useEffect } from "react";
import Layout from "../../components/Layout/Layout";
import { getAdminSession } from "../../utils/session.js";

export default function AdminPrizes() {
  const [brackets, setBrackets] = useState([]);
  const [selected, setSelected] = useState(null);
  const [prizes, setPrizes] = useState([]);
  const [form, setForm] = useState({ label: "", amount: "" });
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    fetch("/api/admin/brackets").then((r) => r.json()).then((d) => setBrackets(d.brackets || []));
  }, []);

  const fetchPrizes = async (bracketId) => {
    const res = await fetch(`/api/admin/prizes?bracket_id=${bracketId}`);
    const data = await res.json();
    setPrizes(data.prizes || []);
  };

  const handleSelect = (bracket) => {
    setSelected(bracket);
    fetchPrizes(bracket.id);
    setMsg(null);
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!selected) return;
    const nextPlace = prizes.length + 1;
    const defaultLabel = nextPlace === 1 ? "1st Place" : nextPlace === 2 ? "2nd Place" : nextPlace === 3 ? "3rd Place" : `${nextPlace}th Place`;
    const res = await fetch("/api/admin/prizes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        bracket_id: selected.id,
        place: nextPlace,
        label: form.label || defaultLabel,
        amount: parseInt(form.amount, 10) || 0,
      }),
    });
    if (res.ok) {
      setForm({ label: "", amount: "" });
      fetchPrizes(selected.id);
      setMsg({ type: "success", text: "Prize added!" });
    }
  };

  const handleDelete = async (id) => {
    await fetch(`/api/admin/prizes?id=${id}`, { method: "DELETE" });
    fetchPrizes(selected.id);
    // Re-number remaining prizes
    const remaining = prizes.filter((p) => p.id !== id);
    for (let i = 0; i < remaining.length; i++) {
      await fetch("/api/admin/prizes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bracket_id: selected.id,
          place: i + 1,
          label: remaining[i].label,
          amount: remaining[i].amount,
        }),
      });
    }
    fetchPrizes(selected.id);
  };

  const totalPrize = prizes.reduce((sum, p) => sum + (p.amount || 0), 0);

  return (
    <Layout isAdmin>
      <h1 className="page-title">Prize <span>Configuration</span></h1>
      <p className="page-subtitle">Set prize amounts for each bracket</p>

      <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: "1.5rem", alignItems: "start" }}>
        {/* Bracket selector */}
        <div className="card">
          <div className="card-title">Select Bracket</div>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {brackets.map((b) => (
              <button
                key={b.id}
                className={`btn ${selected?.id === b.id ? "btn-primary" : "btn-outline"}`}
                onClick={() => handleSelect(b)}
                style={{ justifyContent: "space-between" }}
              >
                <span>{b.name}</span>
                <span className={`badge badge-${b.bracket_type}`}>{b.bracket_type === "scratch" ? "S" : "H"}</span>
              </button>
            ))}
            {brackets.length === 0 && <p style={{ color: "var(--color-text-muted)", fontSize: "0.85rem" }}>No brackets yet.</p>}
          </div>
        </div>

        {/* Prize editor */}
        {selected ? (
          <div>
            <div className="card">
              <div className="card-title">
                {selected.name} Prizes
                {totalPrize > 0 && (
                  <span style={{ fontWeight: 400, color: "var(--color-text-muted)", marginLeft: "0.75rem", fontSize: "0.8rem" }}>
                    Total payout: ${totalPrize.toLocaleString()}
                  </span>
                )}
              </div>

              {prizes.length > 0 ? (
                <table className="data-table" style={{ marginBottom: "1.5rem" }}>
                  <thead>
                    <tr><th>Place</th><th>Label</th><th>Amount</th><th></th></tr>
                  </thead>
                  <tbody>
                    {prizes.map((p) => (
                      <tr key={p.id}>
                        <td style={{ fontFamily: "var(--font-display)", fontWeight: 700 }}>{p.place}</td>
                        <td>{p.label}</td>
                        <td style={{ color: "var(--color-handicap)", fontWeight: 600 }}>${p.amount.toLocaleString()}</td>
                        <td>
                          <button className="btn btn-sm btn-danger" onClick={() => handleDelete(p.id)}>Remove</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p style={{ color: "var(--color-text-muted)", marginBottom: "1rem" }}>No prizes configured yet.</p>
              )}

              <form onSubmit={handleAdd}>
                <div style={{ display: "flex", gap: "0.75rem", alignItems: "flex-end" }}>
                  <div className="form-group" style={{ flex: 2, marginBottom: 0 }}>
                    <label>Label</label>
                    <input
                      value={form.label}
                      onChange={(e) => setForm({ ...form, label: e.target.value })}
                      placeholder={prizes.length === 0 ? "1st Place" : prizes.length === 1 ? "2nd Place" : `${prizes.length + 1}th Place`}
                    />
                  </div>
                  <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                    <label>Amount ($)</label>
                    <input
                      type="number"
                      min="0"
                      value={form.amount}
                      onChange={(e) => setForm({ ...form, amount: e.target.value })}
                      placeholder="300"
                      required
                    />
                  </div>
                  <button type="submit" className="btn btn-primary" style={{ marginBottom: 0 }}>
                    Add Place
                  </button>
                </div>
              </form>
              {msg && <div className={`alert alert-${msg.type}`} style={{ marginTop: "0.75rem" }}>{msg.text}</div>}
            </div>
          </div>
        ) : (
          <div className="card" style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 200 }}>
            <p style={{ color: "var(--color-text-muted)" }}>Select a bracket to configure prizes</p>
          </div>
        )}
      </div>
    </Layout>
  );
}

export const getServerSideProps = async ({ req }) => {
  const session = getAdminSession(req.headers.cookie || "");
  if (!session) return { redirect: { destination: "/admin/login", permanent: false } };
  return { props: {} };
};
