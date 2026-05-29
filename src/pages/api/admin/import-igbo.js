import formidable from "formidable";
import fs from "fs";
import { XMLParser } from "fast-xml-parser";
import { query, calcHandicap } from "../../../utils/db.js";
import { requireAdmin } from "../../../utils/session.js";

export const config = { api: { bodyParser: false } };

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!requireAdmin(req, res)) return;

  const form = formidable({ maxFileSize: 10 * 1024 * 1024 });
  const [, files] = await form.parse(req);
  const file = files.file?.[0];
  if (!file) return res.status(400).json({ error: "No file uploaded" });

  const content = fs.readFileSync(file.filepath, "utf8");

  let parsed;
  try {
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "@_",
      parseAttributeValue: true,
    });
    parsed = parser.parse(content);
  } catch (err) {
    return res.status(400).json({ error: `XML parse error: ${err.message}` });
  }

  // Navigate to PEOPLES > PEOPLE array
  const peoples = parsed?.IGBOTS?.PEOPLES?.PEOPLE;
  if (!peoples) {
    return res.status(400).json({ error: "Could not find PEOPLES/PEOPLE elements in XML. Is this an IGBO-TS export?" });
  }

  const peopleArray = Array.isArray(peoples) ? peoples : [peoples];

  const results = { imported: 0, skipped: 0, errors: [] };

  for (const person of peopleArray) {
    // Skip non-participants and committee members
    if (person["@_nonparticipant"] === "YES" || person["@_committeemember"] === "YES") {
      results.skipped++;
      continue;
    }

    const firstName = (person.FIRST_NAME || "").toString().trim();
    const lastName = (person.LAST_NAME || "").toString().trim();
    const nickname = (person.NICKNAME || "").toString().trim();
    const email = (person.EMAIL || "").toString().trim() || null;

    if (!firstName || !lastName) {
      results.skipped++;
      continue;
    }

    // Use nickname + last name if nickname exists, otherwise first + last
    const displayName = nickname
      ? `${nickname} ${lastName}`
      : `${firstName} ${lastName}`;

    // Get BOOK_AVERAGE — handles both plain value and object with attributes
    let avg = 0;
    const bookAvg = person.BOOK_AVERAGE;
    if (bookAvg !== undefined && bookAvg !== null && bookAvg !== "") {
      if (typeof bookAvg === "object") {
        // Has attributes like verified="YES" — value is in #text
        avg = parseInt(bookAvg["#text"] ?? bookAvg, 10) || 0;
      } else {
        avg = parseInt(bookAvg, 10) || 0;
      }
    }

    // Clamp average to valid range
    avg = Math.max(0, Math.min(300, avg));
    const handicap = calcHandicap(avg);

    try {
      await query(
        `INSERT INTO bowlers (name, email, avg, handicap)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (name) DO UPDATE SET avg = $3, handicap = $4, email = COALESCE($2, bowlers.email)`,
        [displayName, email, avg, handicap]
      );
      results.imported++;
    } catch (err) {
      results.errors.push({ name: displayName, reason: err.message });
      results.skipped++;
    }
  }

  return res.status(200).json(results);
}
