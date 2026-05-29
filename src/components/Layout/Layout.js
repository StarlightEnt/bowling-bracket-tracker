import { useRouter } from "next/router";
import Link from "next/link";

export default function Layout({ children, isAdmin = false }) {
  const router = useRouter();

  const handleLogout = async () => {
    await fetch("/api/admin/auth", { method: "DELETE" });
    router.push("/admin/login");
  };

  return (
    <div className="app-shell">
      <header className="app-header">
        <Link href="/" className="app-logo">
          🎳 Bracket Tracker
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
              <Link
                href="/admin/dashboard"
                className={router.pathname.startsWith("/admin") ? "active" : ""}
              >
                Admin
              </Link>
              <button onClick={handleLogout}>Log Out</button>
            </>
          ) : (
            <Link
              href="/admin/login"
              className={router.pathname === "/admin/login" ? "active" : ""}
            >
              Admin
            </Link>
          )}
        </nav>
      </header>
      <main className="app-main">{children}</main>
    </div>
  );
}
