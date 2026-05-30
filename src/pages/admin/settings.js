import { useState, useEffect, useRef } from "react";
import Layout from "../../components/Layout/Layout";
import { getAdminSession } from "../../utils/session.js";

const PRESET_COLORS = [
  "#f59e0b", "#ef4444", "#10b981", "#3b82f6",
  "#8b5cf6", "#ec4899", "#f97316", "#14b8a6",
];

export default function AdminSettings() {
  const [form, setForm] = useState({
    tournament_name: "",
    tournament_tagline: "",
    tournament_date: "",
    tournament_location: "",
    tournament_welcome: "",
    tournament_logo_url: "",
    primary_color: "#f59e0b",
  });
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);
  const [msg, setMsg] = useState(null);
  const [loading, setLoading] = useState(false);
  const fileRef = useRef();

  useEffect(() => {
    fetch("/api/admin/settings")
      .then((r) => r.json())
      .then((d) => {
        setForm((prev) => ({ ...prev, ...d.settings }));
        if (d.settings?.tournament_logo_url) {
          setLogoPreview(d.settings.tournament_logo_url);
        }
      });
  }, []);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setLogoPreview(ev.target.result);
    reader.readAsDataURL(file);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMsg(null);

    const fd = new FormData();
    for (const [key, value] of Object.entries(form)) {
      fd.append(key, value);
    }
    if (logoFile) fd.append("logo", logoFile);

    const res = await fetch("/api/admin/settings", { method: "POST", body: fd });
    if (res.ok) {
      setMsg({ type: "success", text: "Settings saved!" });
      // Apply new color immediately
      document.documentElement.style.setProperty("--color-amber", form.primary_color);
    } else {
      setMsg({ type: "error", text: "Failed to save settings" });
    }
    setLoading(false);
  };

  const pc = form.primary_color || "#f59e0b";

  return (
    <Layout isAdmin>
      <h1 className="page-title">Tournament <span>Settings</span></h1>
      <p className="page-subtitle">Customize branding and information for your tournament</p>

      <form onSubmit={handleSave}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem", alignItems: "start" }}>

          {/* Branding */}
          <div className="card">
            <div className="card-title">🏆 Tournament Info</div>
            <div className="form-group">
              <label>Tournament Name</label>
              <input value={form.tournament_name} onChange={(e) => setForm({ ...form, tournament_name: e.target.value })} placeholder="Golden Gate Classic" />
            </div>
            <div className="form-group">
              <label>Tagline</label>
              <input value={form.tournament_tagline} onChange={(e) => setForm({ ...form, tournament_tagline: e.target.value })} placeholder="Annual Bowling Championship" />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
              <div className="form-group">
                <label>Date</label>
                <input type="date" value={form.tournament_date} onChange={(e) => setForm({ ...form, tournament_date: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Location</label>
                <input value={form.tournament_location} onChange={(e) => setForm({ ...form, tournament_location: e.target.value })} placeholder="San Francisco, CA" />
              </div>
            </div>
            <div className="form-group">
              <label>Welcome Message (shown on public brackets page)</label>
              <textarea
                value={form.tournament_welcome}
                onChange={(e) => setForm({ ...form, tournament_welcome: e.target.value })}
                placeholder="Welcome to the 2025 tournament!"
                rows={3}
                style={{ resize: "vertical" }}
              />
            </div>
          </div>

          {/* Logo & Colors */}
          <div>
            <div className="card">
              <div className="card-title">🎨 Logo</div>
              <div style={{ display: "flex", gap: "1.5rem", alignItems: "flex-start" }}>
                {/* Preview */}
                <div style={{
                  width: 100, height: 100, borderRadius: "var(--radius)",
                  border: "1px solid var(--color-border)",
                  background: "var(--color-surface-2)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0, overflow: "hidden",
                }}>
                  {logoPreview ? (
                    <img src={logoPreview} alt="Logo preview" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                  ) : (
                    <span style={{ fontSize: "2rem" }}>🎳</span>
                  )}
                </div>
                <div style={{ flex: 1 }}>
                  <div className="form-group">
                    <label>Upload Logo</label>
                    <input type="file" accept="image/*" ref={fileRef} onChange={handleFileChange} />
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "var(--color-text-muted)", margin: "0.25rem 0 0.75rem" }}>— or —</div>
                  <div className="form-group">
                    <label>Logo URL</label>
                    <input
                      value={form.tournament_logo_url.startsWith("data:") ? "" : form.tournament_logo_url}
                      onChange={(e) => {
                        setForm({ ...form, tournament_logo_url: e.target.value });
                        setLogoPreview(e.target.value);
                        setLogoFile(null);
                      }}
                      placeholder="https://example.com/logo.png"
                    />
                  </div>
                  {logoPreview && (
                    <button type="button" className="btn btn-sm btn-danger" onClick={() => {
                      setLogoPreview(null);
                      setLogoFile(null);
                      setForm({ ...form, tournament_logo_url: "" });
                      if (fileRef.current) fileRef.current.value = "";
                    }}>
                      Remove Logo
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="card" style={{ marginTop: "1.5rem" }}>
              <div className="card-title">🎨 Primary Color</div>
              <p style={{ fontSize: "0.85rem", color: "var(--color-text-muted)", marginBottom: "1rem" }}>
                This color is used for highlights, winners, and accents throughout the app.
              </p>
              <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "1rem" }}>
                {PRESET_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setForm({ ...form, primary_color: color })}
                    style={{
                      width: 36, height: 36, borderRadius: "50%",
                      background: color, border: "none", cursor: "pointer",
                      outline: form.primary_color === color ? `3px solid ${color}` : "3px solid transparent",
                      outlineOffset: 2,
                      boxShadow: form.primary_color === color ? "0 0 0 2px var(--color-bg)" : "none",
                      transition: "all 0.15s",
                    }}
                  />
                ))}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                <input
                  type="color"
                  value={form.primary_color}
                  onChange={(e) => setForm({ ...form, primary_color: e.target.value })}
                  style={{ width: 48, height: 36, padding: "2px", cursor: "pointer", background: "none", border: "1px solid var(--color-border)", borderRadius: "var(--radius)" }}
                />
                <input
                  value={form.primary_color}
                  onChange={(e) => setForm({ ...form, primary_color: e.target.value })}
                  placeholder="#f59e0b"
                  style={{ flex: 1, fontFamily: "monospace" }}
                />
                <div style={{ width: 36, height: 36, borderRadius: "var(--radius)", background: pc, flexShrink: 0 }} />
              </div>
            </div>
          </div>
        </div>

        {msg && <div className={`alert alert-${msg.type}`} style={{ marginTop: "1rem" }}>{msg.text}</div>}

        <div style={{ marginTop: "1.5rem" }}>
          <button type="submit" className="btn btn-primary" disabled={loading} style={{ minWidth: 160 }}>
            {loading ? "Saving..." : "Save Settings"}
          </button>
        </div>
      </form>
    </Layout>
  );
}

export const getServerSideProps = async ({ req }) => {
  const session = getAdminSession(req.headers.cookie || "");
  if (!session) return { redirect: { destination: "/admin/login", permanent: false } };
  return { props: {} };
};
