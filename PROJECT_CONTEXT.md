# Bowling MegaBracket Tracker — Project Context

## Live App
- **URL:** https://bowling-bracket-tracker.vercel.app
- **GitHub:** StarlightEnt/bowling-bracket-tracker
- **Stack:** Next.js 14, PostgreSQL (Neon), Vercel

## What This App Does
Tournament bracket tracker for the **San Francisco Golden Gate Classic Invitational** (SFGGCI). Supports 64-player scratch and handicap MegaBrackets across 6 games. Built for live 1080p TV display during tournaments.

## Terminology
- **MegaBracket** = what we call the full 6-game bracket (NOT "bracket" — that means something else in bowling)
- **Scratch / Handicap** = two bracket types (SB1, HB1, etc.)
- **USBC Handicap** = 90% of (225 - average)
- **Chip Draw** = random position assignment by quadrant

## Key Features
- ✅ Bowler roster import (IGBO XML + CSV)
- ✅ USBC handicap calculation
- ✅ Scratch and handicap MegaBrackets (SB1, HB1, etc.)
- ✅ Chip draw system with auto-fill
- ✅ Game score CSV import (6 rounds)
- ✅ Bracket progression with tie handling
- ✅ Full 1080p tournament bracket display
- ✅ Tournament branding (name, logo, colors, date, location)
- ✅ Prize configuration per MegaBracket
- ✅ Public bracket listing with tournament info banner
- ✅ Auto-refresh live display (30 seconds)
- ✅ Admin protected with password
- ✅ Back button (◀ MegaBrackets) on bracket display
- ✅ Tournament logo centered at SVG midpoint in bracket display
- ✅ Prize boxes (1st/2nd top, 3rd+ bottom) with winner names
- ✅ Place-finish logic (2nd=finalist loser, 3rd+=round losers by score)
- ✅ Handicap/Scratch + MegaBracket N watermarks in bracket display
- ✅ Delete scores with reverse-order protection + full reset
- ✅ Bowler roster CSV export
- ✅ MegaBrackets rebrand throughout UI
- ✅ Admin dashboard uniform tile heights
- ✅ Local dev login fixed (see Local Dev section)

## Local Dev Setup
**IMPORTANT:** `.env.local` is ignored by Next.js due to a dotenvx conflict in the environment. Use the startup script instead:

```powershell
.\start-dev.ps1
```

`start-dev.ps1` is gitignored and sets env vars directly:
```powershell
$env:ADMIN_PASSWORD_HASH = '2b:10:KZ3h...'   # BowlingFishBalls, colon-encoded
$env:ADMIN_SESSION_SECRET = '...'
$env:DATABASE_URL = 'postgresql://...'
npm run dev
```

**Auth note:** The bcrypt hash is stored WITHOUT `$` prefixes (as `2b:10:xxx`) because Next.js strips `$` variable expansions from env files. `auth.js` reconstructs the full hash at runtime by replacing the first two colons with `$`.

## Environment Variables (Vercel)
- `ADMIN_PASSWORD_HASH` — bcrypt hash stored as `2b:10:xxx` (colon-encoded, no $ prefix)
- `ADMIN_SESSION_SECRET` — random hex string for session signing
- `DATABASE_URL` — Neon PostgreSQL connection string

## Database Tables
- `bowlers` — roster with name, avg, handicap
- `brackets` — SB1, HB1 etc. with type, status, current_game
- `entries` — bowler positions within brackets (1-64)
- `game_scores` — raw scores per bowler per game
- `matchup_results` — winners per round per bracket
- `bracket_prizes` — place, label, amount per bracket
- `tournament_settings` — branding, logo URL, colors
- `import_log` — score import history

## Score Import Format (CSV)
```
Bowler name,Scratch,Game number
Andy Roper,215,1
```

## Bracket Display Architecture
- SVG-based, designed for 1080p (1920×1080)
- `DISPLAY_W=1920`, `svgW=DISPLAY_W` (full width, not minus padding)
- `svgMid = svgW/2 = 960` — true center for logo and champion text
- `xCenter = HALF_W + CENTER_W/2 = 952` — bracket geometry center (slightly offset, used for bracket lines only)
- Logo: 150×150px centered on `svgMid`
- Watermarks: "Handicap/Scratch" left of logo, "MegaBracket N" right of logo

## Prize Display Logic
- 1st/2nd: large boxes top of center column, aligned with Gm2 slot 1-2
- 3rd+: smaller boxes bottom, aligned with Gm2 winner of slots 25-26
- Place N only assigned when fewer than N players still alive
- 2nd = loser of Gm6; 3rd+ = highest scorer among round losers

## File Structure (key files)
```
src/pages/
  admin/
    dashboard.js       — admin home
    brackets.js        — manage MegaBrackets
    chip-draw.js       — position assignment
    scores.js          — import + delete scores
    prizes.js          — prize configuration
    bowlers.js         — roster + CSV export
    settings.js        — tournament branding
  api/admin/
    auth.js            — login (bcrypt hash reconstruction)
    import-scores.js   — CSV score import + bracket progression
    delete-scores.js   — reverse-order score deletion + full reset
    prizes.js          — prize CRUD
    brackets.js        — bracket CRUD
  api/public/
    brackets.js        — public bracket data (includes prizes)
  brackets/
    index.js           — public MegaBracket listing
    [id].js            — live 1080p bracket display
src/components/
  Layout/Layout.js     — nav (Live MegaBrackets / Admin)
src/utils/
  session.js           — admin session/cookie management
  importScoresCsv.js   — CSV parsing and bowler matching
```

## Remaining To-Do
1. Quadrant zoom / TV auto-rotate display mode
2. Eventually — SFGGC portal auth integration

## Tournament Info
- **Name:** San Francisco Golden Gate Classic Invitational
- **Org:** SFGGCI / SFGGC
- **Logo:** SFGGCI_logo.jpg (518×579px portrait)
- **Primary color:** #f59e0b (amber/gold)
