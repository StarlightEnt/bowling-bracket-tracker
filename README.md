# 🎳 Bowling Bracket Tracker

A standalone Next.js web app for running bowling tournament brackets — supports scratch and handicap brackets, live public display, and CSV score imports. Built to be cloned and deployed by any tournament admin.

---

## Features

- **Scratch & Handicap brackets** — SB1, SB2... and HB1, HB2... with automatic handicap calculation (USBC 90% of 225 formula)
- **64-player brackets** — 4 quadrants of 16, 6 rounds from Round of 64 to Championship
- **Chip draw system** — assign bowler positions by quadrant with a visual slot grid
- **CSV score import** — upload bowling center exports game-by-game; bracket results auto-calculate
- **Tie handling** — tied bowlers both advance and compete in a multi-way matchup next round
- **Live public display** — auto-refreshes every 30 seconds, shows bracket progression and champion
- **Admin panel** — protected by password, manages all setup and scoring

---

## Tech Stack

- **Next.js 14** (Pages Router)
- **Vercel Postgres** (Neon) — free tier
- **Bootstrap Icons + custom SCSS**
- Deployable to **Vercel** in minutes

---

## Setup Guide

### 1. Clone the repo

```bash
git clone https://github.com/YOUR_USERNAME/bowling-bracket-tracker.git
cd bowling-bracket-tracker
npm install
```

### 2. Create a Vercel Postgres database

1. Go to [vercel.com](https://vercel.com) → your project dashboard
2. Click **Storage** → **Create Database** → **Postgres**
3. Follow the prompts — free tier is sufficient
4. Once created, click the database → **`.env.local` tab** → copy all variables

### 3. Configure environment variables

```bash
cp .env.example .env.local
```

Paste in the Postgres variables from Vercel, then add:

```bash
# Generate a session secret
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# Paste the output as ADMIN_SESSION_SECRET

# Generate a password hash
node scripts/hash-password.js yourAdminPassword
# Paste the output as ADMIN_PASSWORD_HASH
```

### 4. Run the database migration

```bash
npm run db:migrate
```

This creates all required tables. Safe to run again — uses `CREATE TABLE IF NOT EXISTS`.

### 5. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## Deploying to Vercel

1. Push the repo to GitHub
2. Go to [vercel.com](https://vercel.com) → **New Project** → import your repo
3. In **Environment Variables**, add:
   - `ADMIN_SESSION_SECRET`
   - `ADMIN_PASSWORD_HASH`
   - All `POSTGRES_*` variables (or link the Vercel Postgres database directly)
4. Deploy — Vercel auto-detects Next.js

---

## Admin Workflow

### Before the tournament

1. **Import bowler roster** → `/admin/bowlers`
   - CSV needs a name column and an average column (flexible header detection)
   - Handicaps are calculated automatically: `FLOOR(0.90 × MAX(0, 225 − average))`

2. **Create brackets** → `/admin/brackets`
   - Scratch brackets: SB1, SB2, etc.
   - Handicap brackets: HB1, HB2, etc.
   - Activate each bracket when ready

3. **Chip draw** → `/admin/chip-draw`
   - Select a bracket, then a quadrant (Q1=1–16, Q2=17–32, Q3=33–48, Q4=49–64)
   - Click any open slot, assign a bowler — repeat for all entries
   - A bowler can appear in multiple brackets/quadrants (separate chip draws)

### During the tournament

4. **Import scores after each game** → `/admin/scores`
   - Select the game number (1–6)
   - Upload the CSV from the bowling center
   - Bracket results calculate automatically
   - Tied bowlers both advance to the next round

### Public display

- Share `/brackets` with bowlers and spectators
- Each bracket has its own live view at `/brackets/[id]`
- Pages auto-refresh every 30 seconds

---

## CSV Score Format

Required columns (extra columns are ignored):

| Column | Description |
|---|---|
| `Bowler name` | Full name — must match the imported roster |
| `Scratch` | Raw game score |
| `Game number` | 1–6 |

Example:
```
Bowler name,Scratch,Game number,Team name,...
Mike Smith,189,1,Lane 4,...
Jane Doe,215,1,Lane 4,...
```

Bowlers are matched by name (case-insensitive). Unmatched names are reported after import and can be corrected by editing the roster.

---

## Bracket Logic

- **Round 1 (Game 1):** position 1 vs 2, 3 vs 4, ... 63 vs 64
- **Round N:** winners of prior round compete; group size doubles each round
- **Ties:** all tied top scorers advance and compete in a larger matchup next round
- **Scratch score:** raw CSV score used as-is
- **Handicap score:** raw CSV score + bowler's pre-calculated handicap

---

## Entry Pricing Reference

| Payment | Entries | Example distribution |
|---|---|---|
| $10 | 1 entry | Any bracket, any quadrant |
| $20 | 2 entries | Any 2 brackets/quadrants |
| $60 | 6 entries | SB1 all 4 quadrants + HB1 any 2 quadrants |

Pricing and distribution is managed outside the app — this tool handles the bracket management and scoring.

---

## License

MIT — free to use, fork, and adapt for your tournament.
