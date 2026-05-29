#!/usr/bin/env node
/**
 * Run this once to create the database schema.
 * Usage: node scripts/migrate.js
 *
 * Requires POSTGRES_URL in your environment (.env.local or shell).
 */

require("dotenv").config({ path: ".env.local" });
const fs = require("fs");
const path = require("path");
const { neon } = require("@neondatabase/serverless");

async function migrate() {
  console.log("Running database migration...");
  const sql = neon(process.env.DATABASE_URL);
  const schemaPath = path.join(__dirname, "../sql/schema.sql");
  const schema = fs.readFileSync(schemaPath, "utf8");

  const statements = schema
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !s.startsWith("--"));

  for (const statement of statements) {
    try {
      await sql(statement);
      const firstLine = statement.split("\n")[0].slice(0, 60);
      console.log(`  ✓ ${firstLine}`);
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
