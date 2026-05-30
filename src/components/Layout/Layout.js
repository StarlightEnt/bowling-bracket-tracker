import { useRouter } from "next/router";
import Link from "next/link";
import { useSettings } from "../../utils/useSettings.js";

export default function Layout({ children, isAdmin = false }) {
  const router = useRouter();
  const { settings } = useSettings();

  const handleLogout = async () => {
    await fetch("/api/admin/auth", { method: "DELETE" });
    router.push("/admin/login");
  };

  const primaryColor = settings.primary_color || "#f59e0b";
  const logoUrl = settings.tournament_logo_url;
  const name = settings.tournament_name || "Bracket Tracker";

  return (
    <div className="app-shell">
      <header className="app-header" style={{ borderBottomColor: primaryColor }}>
        <Link href="/" className="app-logo" style={{ color: primaryColor }}>
          {logoUrl ? (
            <img
              src={logoUrl}
              alt={name}
              style={{ height: 32, maxWidth: 160, objectFit: "contain", verticalAlign: "middle", marginRight: "0.5rem" }}
            />
          ) : (
            "🎳"
          )}
          {" "}{name}
        </Link>
        <nav className="app-nav">
          <Link
            href="/brackets"
            className={router.pathname.startsWith("/brackets") ? "active" : ""}
          >
            Live Brackets
          </Link>
          {isAdmin ? (
            <>
              <Link href="/admin/dashboard" className={router.pathname.startsWith("/admin") ? "active" : ""}>
                Admin
              </Link>
              <button onClick={handleLogout}>Log Out</button>
            </>
          ) : (
            <Link href="/admin/login" className={router.pathname === "/admin/login" ? "active" : ""}>
              Admin
            </Link>
          )}
        </nav>
      </header>
      <main className="app-main">{children}</main>
    </div>
  );
}
