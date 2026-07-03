# STEP CASES — Deploy guide (Netlify + Supabase)

Free CS2 case opening simulator with cloud saves.

## 1. Supabase setup

1. Create a project at [supabase.com](https://supabase.com)
2. Open **SQL Editor** → paste and run `supabase/schema.sql`
3. Go to **Authentication → Providers → Email** and **disable "Confirm email"** (so sign-up works instantly without email verification)
4. Copy from **Project Settings → API**:
   - **Project URL** → `SUPABASE_URL`
   - **anon public** key → `SUPABASE_ANON_KEY`

New accounts start with **$10.00** balance (set in the database trigger).

## 2. Netlify deploy

1. Push this repo to GitHub
2. [Netlify](https://app.netlify.com) → **Add new site** → Import from Git
3. Build settings (auto-read from `netlify.toml`):
   - **Build command:** `node scripts/inject-config.js`
   - **Publish directory:** `.` (root)
4. **Site settings → Environment variables** — add:
   | Key | Value |
   |-----|-------|
   | `SUPABASE_URL` | `https://xxxx.supabase.co` |
   | `SUPABASE_ANON_KEY` | your anon key |
5. Deploy. Each build regenerates `js/config.js` from these variables.

## 3. Local development

```bash
# Copy and edit config
cp js/config.example.js js/config.js
# Fill SUPABASE_URL and SUPABASE_ANON_KEY

# Serve locally
npx http-server -p 8123
```

Without Supabase keys, the site falls back to **localStorage** (offline mode).

## 4. Regenerate case data (optional)

```bash
curl -sL -o tmp-api/crates.json https://raw.githubusercontent.com/ByMykel/CSGO-API/main/public/api/en/crates.json
curl -sL -o tmp-api/skins.json https://raw.githubusercontent.com/ByMykel/CSGO-API/main/public/api/en/skins.json
curl -sL -o tmp-api/steamprices.json https://raw.githubusercontent.com/ByMykel/counter-strike-price-tracker/main/static/latest.json
node scripts/generate-cs2data.js
```

## Architecture

| Layer | Role |
|-------|------|
| `js/config.js` | Supabase URL + anon key |
| `js/db.js` | Auth, profile CRUD, leaderboard, debounced saves |
| `js/auth.js` | Login UI, session restore |
| `profiles` table | balance, inventory, stats, xp per user |

*Educational project — no real money. Skin names © Valve Corporation.*
