import { useState } from "react";
import { useRouter } from "next/router";
import Layout from "../../components/Layout/Layout";
import { parseCookies, getAdminSession } from "../../utils/session.js";

export default function AdminLogin() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await fetch("/api/admin/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    if (res.ok) {
      router.push("/admin/dashboard");
    } else {
      const data = await res.json();
      setError(data.error || "Login failed");
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div style={{ maxWidth: 400, margin: "4rem auto" }}>
        <h1 className="page-title" style={{ textAlign: "center" }}>
          Admin <span>Login</span>
        </h1>
        <div className="card" style={{ marginTop: "1.5rem" }}>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Admin Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                autoFocus
              />
            </div>
            {error && <div className="alert alert-error">{error}</div>}
            <button type="submit" className="btn btn-primary" disabled={loading} style={{ width: "100%" }}>
              {loading ? "Logging in..." : "Log In"}
            </button>
          </form>
        </div>
      </div>
    </Layout>
  );
}

export const getServerSideProps = async ({ req }) => {
  const session = getAdminSession(req.headers.cookie || "");
  if (session) {
    return { redirect: { destination: "/admin/dashboard", permanent: false } };
  }
  return { props: {} };
};
