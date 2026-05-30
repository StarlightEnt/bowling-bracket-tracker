require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');
const sql = neon(process.env.DATABASE_URL);

async function run() {
  await sql`CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
  console.log('settings table created');

  await sql`CREATE TABLE IF NOT EXISTS bracket_prizes (
    id SERIAL PRIMARY KEY,
    bracket_id INTEGER NOT NULL REFERENCES brackets(id) ON DELETE CASCADE,
    place INTEGER NOT NULL,
    label TEXT NOT NULL,
    amount INTEGER NOT NULL,
    UNIQUE (bracket_id, place)
  )`;
  console.log('bracket_prizes table created');

  await sql`INSERT INTO settings (key, value) VALUES
    ('tournament_name', 'Bowling Bracket Tournament'),
    ('tournament_tagline', ''),
    ('tournament_date', ''),
    ('tournament_location', ''),
    ('tournament_welcome', ''),
    ('tournament_logo_url', ''),
    ('primary_color', '#f59e0b')
    ON CONFLICT (key) DO NOTHING`;
  console.log('default settings inserted');
  console.log('All done!');
}

run().catch(e => console.error('Error:', e.message));
