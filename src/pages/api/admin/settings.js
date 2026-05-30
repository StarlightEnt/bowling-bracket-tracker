import { query } from "../../../utils/db.js";
import { requireAdmin } from "../../../utils/session.js";
import formidable from "formidable";
import fs from "fs";
import path from "path";

export const config = { api: { bodyParser: false } };

export default async function handler(req, res) {
  if (req.method === "GET") {
    const { rows } = await query("SELECT key, value FROM settings ORDER BY key");
    const settings = {};
    for (const row of rows) settings[row.key] = row.value;
    return res.status(200).json({ settings });
  }

  if (req.method === "POST") {
    if (!requireAdmin(req, res)) return;

    const form = formidable({ maxFileSize: 2 * 1024 * 1024 });
    const [fields, files] = await form.parse(req);

    // Handle logo file upload
    let logoUrl = null;
    const logoFile = files.logo?.[0];
    if (logoFile && logoFile.size > 0) {
      // Store as base64 data URL for simplicity (no external storage needed)
      const buffer = fs.readFileSync(logoFile.filepath);
      const base64 = buffer.toString("base64");
      const mimeType = logoFile.mimetype || "image/png";
      logoUrl = `data:${mimeType};base64,${base64}`;
    }

    // Build updates from fields
    const updates = {};
    const allowedKeys = [
      "tournament_name", "tournament_tagline", "tournament_date",
      "tournament_location", "tournament_welcome", "tournament_logo_url",
      "primary_color"
    ];

    for (const key of allowedKeys) {
      if (fields[key]?.[0] !== undefined) {
        updates[key] = fields[key][0];
      }
    }

    // Override logo_url if file was uploaded
    if (logoUrl) updates["tournament_logo_url"] = logoUrl;

    // Upsert each setting
    for (const [key, value] of Object.entries(updates)) {
      await query(
        `INSERT INTO settings (key, value, updated_at)
         VALUES ($1, $2, NOW())
         ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()`,
        [key, value]
      );
    }

    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
