import crypto from "crypto";

const COOKIE_ADMIN = "bracket_admin";
const SESSION_TTL_MS = 8 * 60 * 60 * 1000; // 8 hours

const getSecret = () => {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret) throw new Error("ADMIN_SESSION_SECRET is not set.");
  return secret;
};

const base64UrlEncode = (value) => Buffer.from(value).toString("base64url");
const base64UrlDecode = (value) => Buffer.from(value, "base64url").toString("utf8");

const signPayload = (payload) => {
  const secret = getSecret();
  const data = base64UrlEncode(JSON.stringify(payload));
  const sig = crypto.createHmac("sha256", secret).update(data).digest("base64url");
  return `${data}.${sig}`;
};

const verifyToken = (token) => {
  if (!token || !token.includes(".")) return null;
  try {
    const [data, sig] = token.split(".");
    const secret = getSecret();
    const expected = crypto.createHmac("sha256", secret).update(data).digest("base64url");
    if (expected !== sig) return null;
    const payload = JSON.parse(base64UrlDecode(data));
    if (payload.exp && Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
};

const buildSessionToken = () => {
  const now = Date.now();
  return signPayload({ role: "admin", iat: now, exp: now + SESSION_TTL_MS });
};

const parseCookies = (cookieHeader = "") =>
  cookieHeader.split(";").reduce((acc, pair) => {
    const [rawKey, ...rest] = pair.trim().split("=");
    if (rawKey) acc[rawKey.trim()] = rest.join("=");
    return acc;
  }, {});

const getAdminSession = (cookieHeader = "") => {
  const cookies = parseCookies(cookieHeader);
  const token = cookies[COOKIE_ADMIN];
  const payload = verifyToken(token);
  if (!payload || payload.role !== "admin") return null;
  return payload;
};

const isProduction = () => process.env.NODE_ENV === "production";

const buildCookieString = (name, value, maxAgeSeconds) => {
  const parts = [`${name}=${value}`, "HttpOnly", "Path=/", "SameSite=Lax", `Max-Age=${maxAgeSeconds}`];
  if (isProduction()) parts.push("Secure");
  return parts.join("; ");
};

const buildExpiredCookie = (name) => buildCookieString(name, "", 0);

// Middleware: require admin session on API routes
const requireAdmin = (req, res) => {
  const session = getAdminSession(req.headers.cookie || "");
  if (!session) {
    res.status(401).json({ error: "Unauthorized" });
    return null;
  }
  return session;
};

export {
  COOKIE_ADMIN,
  SESSION_TTL_MS,
  buildSessionToken,
  verifyToken,
  parseCookies,
  getAdminSession,
  buildCookieString,
  buildExpiredCookie,
  requireAdmin,
};
