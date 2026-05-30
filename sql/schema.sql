-- ============================================================
-- Bowling Bracket Tracker — Database Schema
-- Vercel Postgres (PostgreSQL)
-- ============================================================

-- Bowlers registered for the tournament
CREATE TABLE IF NOT EXISTS bowlers (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL,
  email       TEXT,
  avg         INTEGER NOT NULL DEFAULT 0,
  handicap    INTEGER NOT NULL DEFAULT 0,  -- FLOOR(0.9 * MAX(0, 225 - avg))
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (name)
);

-- Brackets (SB1, SB2, HB1, HB2, etc.)
CREATE TABLE IF NOT EXISTS brackets (
  id            SERIAL PRIMARY KEY,
  name          TEXT NOT NULL UNIQUE,   -- e.g. "SB1", "HB2"
  bracket_type  TEXT NOT NULL CHECK (bracket_type IN ('scratch', 'handicap')),
  status        TEXT NOT NULL DEFAULT 'setup'
                  CHECK (status IN ('setup', 'active', 'complete')),
  current_game  INTEGER NOT NULL DEFAULT 0,  -- 0 = not started, 1-6 = current game
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Individual entries in a bracket (one per chip drawn)
-- A bowler can have multiple entries across brackets/quadrants
CREATE TABLE IF NOT EXISTS entries (
  id          SERIAL PRIMARY KEY,
  bracket_id  INTEGER NOT NULL REFERENCES brackets(id) ON DELETE CASCADE,
  bowler_id   INTEGER NOT NULL REFERENCES bowlers(id) ON DELETE CASCADE,
  position    INTEGER NOT NULL CHECK (position BETWEEN 1 AND 64),
  quadrant    INTEGER NOT NULL CHECK (quadrant BETWEEN 1 AND 4),
  -- quadrant 1 = pos 1-16, quadrant 2 = pos 17-32, etc.
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (bracket_id, position)   -- one bowler per slot per bracket
);

-- Scores per bowler per game (raw scratch scores from CSV)
CREATE TABLE IF NOT EXISTS game_scores (
  id          SERIAL PRIMARY KEY,
  bowler_id   INTEGER NOT NULL REFERENCES bowlers(id) ON DELETE CASCADE,
  game_number INTEGER NOT NULL CHECK (game_number BETWEEN 1 AND 6),
  raw_score   INTEGER NOT NULL,
  imported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  imported_by TEXT,   -- admin identifier
  UNIQUE (bowler_id, game_number)
);

-- Bracket matchup results per round (derived, but stored for fast display)
-- Each row represents one matchup in one game/round
CREATE TABLE IF NOT EXISTS matchup_results (
  id              SERIAL PRIMARY KEY,
  bracket_id      INTEGER NOT NULL REFERENCES brackets(id) ON DELETE CASCADE,
  game_number     INTEGER NOT NULL CHECK (game_number BETWEEN 1 AND 6),
  -- The positions involved in this matchup (stored as sorted CSV: "1,2" or "1,2,3")
  positions       TEXT NOT NULL,
  winner_position INTEGER,   -- NULL until scores are in; set to winning position
  calculated_at   TIMESTAMPTZ,
  UNIQUE (bracket_id, game_number, positions)
);

-- Admin sessions
CREATE TABLE IF NOT EXISTS admin_sessions (
  token       TEXT PRIMARY KEY,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at  TIMESTAMPTZ NOT NULL
);

-- Score import audit log
CREATE TABLE IF NOT EXISTS import_log (
  id          SERIAL PRIMARY KEY,
  game_number INTEGER NOT NULL,
  filename    TEXT,
  rows_total  INTEGER NOT NULL DEFAULT 0,
  rows_matched INTEGER NOT NULL DEFAULT 0,
  rows_skipped INTEGER NOT NULL DEFAULT 0,
  imported_by TEXT,
  imported_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- Indexes for common query patterns
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_entries_bracket   ON entries(bracket_id);
CREATE INDEX IF NOT EXISTS idx_entries_bowler    ON entries(bowler_id);
CREATE INDEX IF NOT EXISTS idx_game_scores_bowler ON game_scores(bowler_id);
CREATE INDEX IF NOT EXISTS idx_matchup_bracket_game ON matchup_results(bracket_id, game_number);

-- Tournament settings (key/value store)
CREATE TABLE IF NOT EXISTS settings (
  key         TEXT PRIMARY KEY,
  value       TEXT,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Default settings
INSERT INTO settings (key, value) VALUES
  ('tournament_name', 'Bowling Bracket Tournament'),
  ('tournament_tagline', ''),
  ('tournament_date', ''),
  ('tournament_location', ''),
  ('tournament_welcome', ''),
  ('tournament_logo_url', ''),
  ('primary_color', '#f59e0b')
ON CONFLICT (key) DO NOTHING;

-- Prize amounts per bracket
CREATE TABLE IF NOT EXISTS bracket_prizes (
  id          SERIAL PRIMARY KEY,
  bracket_id  INTEGER NOT NULL REFERENCES brackets(id) ON DELETE CASCADE,
  place       INTEGER NOT NULL,  -- 1=first, 2=second, etc.
  label       TEXT NOT NULL,     -- e.g. "1st Place"
  amount      INTEGER NOT NULL,  -- in dollars
  UNIQUE (bracket_id, place)
);
