#!/usr/bin/env node
require("dotenv").config({ path: ".env.local" });
const fs = require("fs");
const path = require("path");
const { neon } = require("@neondatabase/serverless");

async function migrate() {
  console.log("Running database migration...");
  const sql = neon(process.env.DATABASE_URL);
  const schemaPath = path.join(__dirname, "../sql/schema.sql");
  const schema = fs.readFileSync(schemaPath, "utf8");

  const stripped = schema
    .split("\n")
    .map((line) => {
      const commentIdx = line.indexOf("--");
      return commentIdx >= 0 ? line.slice(0, commentIdx) : line;
    })
    .join("\n");

  const statements = stripped
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  for (const statement of statements) {
    try {
      await sql(statement);
      const firstLine = statement.split("\n").find((l) => l.trim().length > 0) || "";
      console.log(`  ✓ ${firstLine.trim().slice(0, 60)}`);
    } catch (err) {
      console.error(`  ✗ Failed: ${statement.slice(0, 80)}`);
      console.error(`    ${err.message}`);
      process.exit(1);
    }
  }

  console.log("\nMigration complete.");
  process.exit(0);
}

migrate();