import formidable from "formidable";
import fs from "fs";
import { parse } from "csv-parse/sync";
import { query, calcHandicap } from "../../../utils/db.js";
import { requireAdmin } from "../../../utils/session.js";

export const config = { api: { bodyParser: false } };

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!requireAdmin(req, res)) return;

  const form = formidable({ maxFileSize: 5 * 1024 * 1024 });
  const [, files] = await form.parse(req);
  const file = files.file?.[0];
  if (!file) return res.status(400).json({ error: "No file uploaded" });

  const content = fs.readFileSync(file.filepath, "utf8");
  let rows;
  try {
    rows = parse(content, { columns: true, skip_empty_lines: true, trim: true });
  } catch (err) {
    return res.status(400).json({ error: `CSV parse error: ${err.message}` });
  }

  // Detect name and average columns flexibly
  const headers = Object.keys(rows[0] || {});
  const nameCol = headers.find((h) =>
    /bowler.?name|full.?name|name/i.test(h)
  );
  const avgCol = headers.find((h) =>
    /avg|average|entering.?avg/i.test(h)
  );

  if (!nameCol || !avgCol) {
    return res.status(400).json({
      error: `Could not detect required columns. Found: ${headers.join(", ")}. Need a name column and an average column.`,
    });
  }

  const results = { imported: 0, skipped: 0, errors: [] };

  for (const row of rows) {
    const name = (row[nameCol] || "").trim();
    const avgRaw = (row[avgCol] || "").trim();
    if (!name) continue;

    const avg = parseInt(avgRaw, 10);
    if (isNaN(avg) || avg < 0 || avg > 300) {
      results.errors.push({ name, reason: `Invalid average: "${avgRaw}"` });
      results.skipped++;
      continue;
    }

    const handicap = calcHandicap(avg);
    try {
      await query(
        `INSERT INTO bowlers (name, avg, handicap)
         VALUES ($1, $2, $3)
         ON CONFLICT (name) DO UPDATE SET avg = $2, handicap = $3`,
        [name, avg, handicap]
      );
      results.imported++;
    } catch (err) {
      results.errors.push({ name, reason: err.message });
      results.skipped++;
    }
  }

  return res.status(200).json(results);
}
