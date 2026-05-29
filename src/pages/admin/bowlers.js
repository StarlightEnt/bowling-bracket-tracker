import { useState, useEffect, useRef } from "react";
import Layout from "../../components/Layout/Layout";
import { getAdminSession } from "../../utils/session.js";

export default function AdminBowlers() {
  const [bowlers, setBowlers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: "", email: "", avg: "" });
  const [msg, setMsg] = useState(null);
  const [importResult, setImportResult] = useState(null);
  const fileRef = useRef();

  const fetchBowlers = async () => {
    const res = await fetch("/api/admin/bowlers");
    const data = await res.json();
    setBowlers(data.bowlers || []);
    setLoading(false);
  };

  useEffect(() => { fetchBowlers(); }, []);

  const handleAdd = async (e) => {
    e.preventDefault();
    setMsg(null);
    const res = await fetch("/api/admin/bowlers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    if (res.ok) {
      setMsg({ type: "success", text: `${data.bowler.name} added (handicap: ${data.bowler.handicap})` });
      setForm({ name: "", email: "", avg: "" });
      fetchBowlers();
    } else {
      setMsg({ type: "error", text: data.error });
    }
  };

  const handleDelete = async (id, name) => {
    if (!confirm(`Remove ${name} from the roster?`)) return;
    await fetch(`/api/admin/bowlers?id=${id}`, { method: "DELETE" });
    fetchBowlers();
  };

  const handleImport = async (e) => {
    e.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file) return;
    setImportResult(null);
    const fd = new FormData();
    fd.append("file", file);
    const isXml = file.name.toLowerCase().endsWith(".xml");
    const url = isXml ? "/api/admin/import-igbo" : "/api/admin/import-roster";
    const res = await fetch(url, { method: "POST", body: fd });
    const data = await res.json();
    setImportResult(data);
    fetchBowlers();
    fileRef.current.value = "";
  };

  return (
    <Layout isAdmin>
      <h1 className="page-title">Bowler <span>Roster</span></h1>
      <p className="page-subtitle">Import or manually add bowlers with their entering averages</p>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem" }}>
        {/* CSV Import */}
        <div className="card">
          <div className="card-title">📂 Import from CSV</div>
          <p style={{ fontSize: "0.85rem", color: "var(--color-text-muted)", marginBottom: "1rem" }}>
            Accepts IGBO-TS XML exports (.xml) or CSV files (.csv) with name and average columns. IGBO XML imports use BOOK_AVERAGE as the entering average.
            Existing bowlers are updated if re-imported.
          </p>
          <form onSubmit={handleImport}>
            <div className="form-group">
              <label>CSV File</label>
              <input type="file" accept=".csv,.xml" ref={fileRef} />
            </div>
            <button type="submit" className="btn btn-primary">Import Roster</button>
          </form>
          {importResult && (
            <div className={`alert ${importResult.errors?.length ? "alert-info" : "alert-success"}`} style={{ marginTop: "1rem" }}>
              Imported {importResult.imported}, skipped {importResult.skipped}
              {importResult.errors?.length > 0 && (
                <ul style={{ marginTop: "0.5rem", paddingLeft: "1rem" }}>
                  {importResult.errors.map((e, i) => <li key={i}>{e.name}: {e.reason}</li>)}
                </ul>
              )}
            </div>
          )}
        </div>

        {/* Manual Add */}
        <div className="card">
          <div className="card-title">➕ Add Bowler Manually</div>
          <form onSubmit={handleAdd}>
            <div className="form-group">
              <label>Full Name</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Jane Smith" required />
            </div>
            <div className="form-group">
              <label>Entering Average</label>
              <input type="number" min="0" max="300" value={form.avg} onChange={(e) => setForm({ ...form, avg: e.target.value })} placeholder="185" required />
            </div>
            <div className="form-group">
              <label>Email (optional)</label>
              <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="jane@example.com" />
            </div>
            {form.avg && !isNaN(parseInt(form.avg)) && (
              <div style={{ fontSize: "0.82rem", color: "var(--color-text-muted)", marginBottom: "0.75rem" }}>
                Handicap: <strong style={{ color: "var(--color-handicap)" }}>
                  {Math.floor(0.9 * Math.max(0, 225 - parseInt(form.avg)))}
                </strong> pins
              </div>
            )}
            {msg && <div className={`alert alert-${msg.type}`}>{msg.text}</div>}
            <button type="submit" className="btn btn-primary">Add Bowler</button>
          </form>
        </div>
      </div>

      {/* Roster table */}
      <div className="card">
        <div className="card-title">Roster ({bowlers.length} bowlers)</div>
        {loading ? (
          <p style={{ color: "var(--color-text-muted)" }}>Loading...</p>
        ) : bowlers.length === 0 ? (
          <p style={{ color: "var(--color-text-muted)" }}>No bowlers yet. Import a CSV or add manually.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Entering Avg</th>
                <th>Handicap</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {bowlers.map((b) => (
                <tr key={b.id}>
                  <td>{b.name}</td>
                  <td>{b.avg}</td>
                  <td style={{ color: "var(--color-handicap)", fontWeight: 600 }}>{b.handicap}</td>
                  <td>
                    <button className="btn btn-sm btn-danger" onClick={() => handleDelete(b.id, b.name)}>Remove</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
