import bcrypt from "bcryptjs";
import {
  buildSessionToken,
  buildCookieString,
  buildExpiredCookie,
  getAdminSession,
  COOKIE_ADMIN,
  SESSION_TTL_MS,
} from "../../../utils/session.js";

export default async function handler(req, res) {
  if (req.method === "POST") {
    const { password } = req.body || {};
    if (!password) return res.status(400).json({ error: "Password required" });

    const hash = process.env.ADMIN_PASSWORD_HASH;
    if (!hash) return res.status(500).json({ error: "Admin password not configured" });

    const valid = await bcrypt.compare(password, hash);
    if (!valid) return res.status(401).json({ error: "Invalid password" });

    const token = buildSessionToken();
    const cookie = buildCookieString(COOKIE_ADMIN, token, SESSION_TTL_MS / 1000);
    res.setHeader("Set-Cookie", cookie);
    return res.status(200).json({ ok: true });
  }

  if (req.method === "DELETE") {
    res.setHeader("Set-Cookie", buildExpiredCookie(COOKIE_ADMIN));
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
