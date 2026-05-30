import { useState, useEffect } from "react";
import Link from "next/link";
import Layout from "../../components/Layout/Layout";
import { getAdminSession } from "../../utils/session.js";

export default function AdminDashboard() {
  const [brackets, setBrackets] = useState([]);
  const [bowlerCount, setBowlerCount] = useState(0);

  useEffect(() => {
    fetch("/api/public/brackets").then((r) => r.json()).then((d) => setBrackets(d.brackets || []));
    fetch("/api/admin/bowlers").then((r) => r.json()).then((d) => setBowlerCount(d.bowlers?.length || 0));
  }, []);

  const activeBrackets = brackets.filter((b) => b.status === "active").length;
  const totalEntries = brackets.reduce((sum, b) => sum + parseInt(b.entry_count || 0), 0);

  return (
    <Layout isAdmin>
      <h1 className="page-title">Admin <span>Dashboard</span></h1>
      <p className="page-subtitle">Manage your bowling bracket tournament</p>

      {/* Stats row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "1rem", marginBottom: "2rem" }}>
        {[
          { label: "Bowlers", value: bowlerCount, color: "var(--color-text)" },
          { label: "Brackets", value: brackets.length, color: "var(--color-amber)" },
          { label: "Active", value: activeBrackets, color: "var(--color-handicap)" },
          { label: "Total Entries", value: totalEntries, color: "var(--color-scratch)" },
        ].map(({ label, value, color }) => (
          <div key={label} className="card" style={{ textAlign: "center", padding: "1.25rem" }}>
            <div style={{ fontFamily: "var(--font-display)", fontSize: "2.2rem", fontWeight: 800, color }}>{value}</div>
            <div style={{ fontFamily: "var(--font-display)", fontSize: "0.7rem", letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--color-text-muted)", marginTop: "0.2rem" }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Action cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "1rem" }}>
        <ActionCard
          href="/admin/bowlers"
          icon="👤"
          title="Bowler Roster"
          description="Import bowlers from CSV, view averages and handicaps"
          color="var(--color-text)"
        />
        <ActionCard
          href="/admin/brackets"
          icon="🏆"
          title="Brackets"
          description="Create and manage scratch and handicap brackets"
          color="var(--color-amber)"
        />
        <ActionCard
          href="/admin/chip-draw"
          icon="🎱"
          title="Chip Draw"
          description="Assign bowler positions by quadrant chip draw"
          color="var(--color-scratch)"
        />
        <ActionCard
          href="/admin/scores"
          icon="📊"
          title="Import Scores"
          description="Upload game CSV to update scores and advance brackets"
          color="var(--color-handicap)"
        />
        <ActionCard
          href="/admin/prizes"
          icon="💰"
          title="Prize Config"
          description="Set prize amounts for each bracket"
          color="#10b981"
        />
        <ActionCard
          href="/admin/settings"
          icon="⚙️"
          title="Settings"
          description="Tournament branding, logo, colors and info"
          color="#8b5cf6"
        />
      </div>

      {/* Brackets quick status */}
      {brackets.length > 0 && (
        <div className="card" style={{ marginTop: "2rem" }}>
          <div className="card-title">Bracket Status</div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Bracket</th>
                <th>Type</th>
                <th>Entries</th>
                <th>Game</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {brackets.map((b) => (
                <tr key={b.id}>
                  <td style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "1.1rem" }}>{b.name}</td>
                  <td><span className={`badge badge-${b.bracket_type}`}>{b.bracket_type}</span></td>
                  <td>{b.entry_count} / 64</td>
                  <td>{b.current_game > 0 ? `Game ${b.current_game}` : "—"}</td>
                  <td><span className={`badge badge-${b.status}`}>{b.status}</span></td>
                  <td><Link href={`/brackets/${b.id}`} className="btn btn-sm btn-outline">View</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Layout>
  );
}

function ActionCard({ href, icon, title, description, color }) {
  return (
    <Link href={href} style={{ textDecoration: "none" }}>
      <div className="card" style={{ cursor: "pointer", transition: "border-color 0.15s, transform 0.15s", minHeight: "130px", display: "flex", flexDirection: "column", justifyContent: "center" }}
        onMouseEnter={(e) => { e.currentTarget.style.borderColor = color; e.currentTarget.style.transform = "translateY(-2px)"; }}
        onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--color-border)"; e.currentTarget.style.transform = "none"; }}
      >
        <div style={{ fontSize: "1.8rem", marginBottom: "0.5rem" }}>{icon}</div>
        <h3 style={{ fontFamily: "var(--font-display)", fontSize: "1.1rem", fontWeight: 700, color, margin: "0 0 0.35rem" }}>{title}</h3>
        <p style={{ color: "var(--color-text-muted)", fontSize: "0.85rem", margin: 0 }}>{description}</p>
      </div>
    </Link>
  );
}

export const getServerSideProps = async ({ req }) => {
  const session = getAdminSession(req.headers.cookie || "");
  if (!session) return { redirect: { destination: "/admin/login", permanent: false } };
  return { props: {} };
};
