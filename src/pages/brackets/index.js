import { useState, useEffect } from "react";
import Link from "next/link";
import Layout from "../../components/Layout/Layout";
import { useSettings } from "../../utils/useSettings.js";

export default function BracketsPage() {
  const [brackets, setBrackets] = useState([]);
  const [loading, setLoading] = useState(true);
  const { settings } = useSettings();

  const fetchBrackets = async () => {
    const res = await fetch("/api/public/brackets");
    if (res.ok) {
      const data = await res.json();
      setBrackets(data.brackets || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchBrackets();
    const interval = setInterval(fetchBrackets, 30000);
    return () => clearInterval(interval);
  }, []);

  const scratch = brackets.filter((b) => b.bracket_type === "scratch");
  const handicap = brackets.filter((b) => b.bracket_type === "handicap");

  return (
    <Layout>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "2rem" }}>
        <div>
          <h1 className="page-title">Live <span>Brackets</span></h1>
          <p className="page-subtitle">Auto-refreshes every 30 seconds</p>
        </div>
        <div className="live-indicator">
          <div className="pulse" />
          Live
        </div>
      </div>

      {/* Tournament info banner */}
      {(settings.tournament_date || settings.tournament_location || settings.tournament_welcome) && (
        <div className="card" style={{ marginBottom: "1.5rem", background: "var(--color-surface-2)", borderColor: "var(--color-border)" }}>
          <div style={{ display: "flex", gap: "2rem", alignItems: "center", flexWrap: "wrap" }}>
            {settings.tournament_date && (
              <div>
                <div style={{ fontSize: "0.7rem", fontFamily: "var(--font-display)", letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--color-text-muted)" }}>Date</div>
                <div style={{ fontWeight: 600 }}>{new Date(settings.tournament_date).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</div>
              </div>
            )}
            {settings.tournament_location && (
              <div>
                <div style={{ fontSize: "0.7rem", fontFamily: "var(--font-display)", letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--color-text-muted)" }}>Location</div>
                <div style={{ fontWeight: 600 }}>{settings.tournament_location}</div>
              </div>
            )}
            {settings.tournament_tagline && (
              <div style={{ color: "var(--color-text-muted)", fontStyle: "italic" }}>{settings.tournament_tagline}</div>
            )}
            {settings.tournament_welcome && (
              <div style={{ flex: 1, color: "var(--color-text-muted)" }}>{settings.tournament_welcome}</div>
            )}
          </div>
        </div>
      )}

      {loading && <p style={{ color: "var(--color-text-muted)" }}>Loading brackets...</p>}

      {!loading && brackets.length === 0 && (
        <div className="card">
          <p style={{ color: "var(--color-text-muted)", textAlign: "center", padding: "2rem 0" }}>
            No brackets have been set up yet. Check back soon!
          </p>
        </div>
      )}

      {scratch.length > 0 && (
        <section style={{ marginBottom: "2rem" }}>
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: "1rem", letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--color-scratch)", marginBottom: "1rem" }}>
            Scratch Brackets
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "1rem" }}>
            {scratch.map((b) => <BracketCard key={b.id} bracket={b} />)}
          </div>
        </section>
      )}

      {handicap.length > 0 && (
        <section>
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: "1rem", letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--color-handicap)", marginBottom: "1rem" }}>
            Handicap Brackets
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "1rem" }}>
            {handicap.map((b) => <BracketCard key={b.id} bracket={b} />)}
          </div>
        </section>
      )}
    </Layout>
  );
}

function BracketCard({ bracket }) {
  const gameLabel = bracket.current_game > 0
    ? `Game ${bracket.current_game} of 6`
    : "Not started";

  return (
    <Link href={`/brackets/${bracket.id}`} style={{ textDecoration: "none" }}>
      <div className="card" style={{ cursor: "pointer", transition: "border-color 0.15s", borderColor: "var(--color-border)" }}
        onMouseEnter={(e) => e.currentTarget.style.borderColor = "var(--color-amber)"}
        onMouseLeave={(e) => e.currentTarget.style.borderColor = "var(--color-border)"}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <h3 style={{ fontFamily: "var(--font-display)", fontSize: "1.8rem", fontWeight: 800, color: "var(--color-amber)", margin: 0 }}>
            {bracket.name}
          </h3>
          <span className={`badge badge-${bracket.status}`}>{bracket.status}</span>
        </div>
        <div style={{ marginTop: "0.75rem", display: "flex", gap: "0.75rem", alignItems: "center" }}>
          <span className={`badge badge-${bracket.bracket_type}`}>{bracket.bracket_type}</span>
          <span style={{ fontSize: "0.82rem", color: "var(--color-text-muted)" }}>
            {bracket.entry_count} / 64 entries
          </span>
        </div>
        <div style={{ marginTop: "0.5rem", fontSize: "0.82rem", color: "var(--color-text-muted)" }}>
          {gameLabel}
        </div>
      </div>
    </Link>
  );
}
