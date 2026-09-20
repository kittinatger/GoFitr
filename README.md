# GoFitr

**Try it live: [go-fitr-kittinat-gerdsri.vercel.app](https://go-fitr-kittinat-gerdsri.vercel.app)**

A simple, local-first fitness tracker. Sign in with Google, Apple, GitHub, Facebook, Vercel, or a local username/password, and your workout data stays in your browser's `localStorage` — nothing is synced to a server.

## Features

- Log in with Google, Apple, GitHub, or Facebook (via Clerk), Vercel (via Supabase Auth), or create a local account (each account's data stays private on that device)
- Log workouts with multiple sets (reps × weight) and notes
- Dashboard with streak, weekly volume, and weekly/total workout counts
- Full workout history with per-exercise filtering
- Progress charts (max weight & volume over time) and personal records
- Body weight logging with a trend chart
- Nutrition tracking with a daily food log, calorie/macro goals, and food lookup by search or barcode scan across multiple nutrition databases
- kg/lb unit toggle
- Export/import your data as JSON, or clear it entirely

## Running locally

Any static file server works, e.g.:

```bash
python -m http.server 8123
```

Then open `http://localhost:8123`. You can also just open `index.html` directly in a browser.

Note: this only serves the static files, so local username/password accounts work fine everywhere, and the social login buttons work too as soon as their keys are filled in (see below) — no serverless functions or Vercel deployment needed for auth, since both Clerk and Supabase handle it entirely from the browser.

## Social login setup

Google, Apple, GitHub, and Facebook go through [Clerk](https://clerk.com); Vercel goes through [Supabase Auth](https://supabase.com/auth) as a custom OIDC provider (Clerk's free tier doesn't support arbitrary custom OAuth/OIDC connections the way Supabase does). Both run entirely from the client — there's no `api/` code involved for either.

### Clerk (Google, Apple, GitHub, Facebook)

1. Create a free app at [clerk.com](https://clerk.com).
2. In `index.html`, update the Clerk `<script>` tag's `data-clerk-publishable-key` and `src` (the domain in `src` is your app's Frontend API, shown on the Clerk dashboard). In `js/app.js`, update `CLERK_PUBLISHABLE_KEY` to match.
3. In the Clerk dashboard, under **User & Authentication → Social Connections**, enable Google, Apple, GitHub, and Facebook. Clerk ships with shared development credentials for most providers, so they can work immediately in dev — for production you'll want to swap in your own OAuth client ID/secret for each (same provider setup steps as below, using Clerk's own callback URL instead of Supabase's).
4. Apple specifically needs your own Service ID/Team ID/Key ID/private key from the [Apple Developer portal](https://developer.apple.com/account/resources/identifiers/list/serviceId) (requires a paid Apple Developer account) even in Clerk, since Apple doesn't offer shared dev credentials.

### Supabase Auth (Vercel)

1. Create a free project at [supabase.com](https://supabase.com).
2. In `js/app.js`, fill in `SUPABASE_URL` and `SUPABASE_ANON_KEY` near the top of the file (from your project's Settings → API — the anon key is public/safe to ship in client code).
3. In the Supabase dashboard, go to **Authentication → Sign In / Providers**, scroll to **Custom Providers**, and add Vercel as a custom OIDC provider:
   - Issuer URL: `https://vercel.com`
   - Client ID / Secret: from a [Vercel App](https://vercel.com/docs/sign-in-with-vercel/getting-started) (Team Settings → Apps → Create), with its Authorization Callback URL set to the callback URL Supabase shows on this screen
   - Provider Identifier: `vercel` — Supabase prefixes custom providers with `custom:`, so the resulting identifier (`custom:vercel`) must match `VERCEL_OIDC_PROVIDER_SLUG` in `js/app.js`
   - If Auto-discovery fails, switch to Manual Configuration using Vercel's published endpoints: authorization `https://vercel.com/oauth/authorize`, token `https://api.vercel.com/login/oauth/token`, userinfo `https://api.vercel.com/login/oauth/userinfo`, JWKS `https://vercel.com/.well-known/jwks`

Every button quietly shows a "not configured" toast instead of breaking anything until its keys/provider are set up.

## Nutrition database setup

Food search and barcode scanning in the Nutrition tab check multiple databases in order, each backed by a serverless proxy under `api/nutrition/` that keeps its API key server-side. All of these are optional — search/barcode lookup just skips any source whose keys aren't set:

- **Open Food Facts** — free, no key, always on.
- **USDA FoodData Central** — free, no cost, key at [fdc.nal.usda.gov/api-key-signup](https://fdc.nal.usda.gov/api-key-signup). Env var: `USDA_API_KEY`.
- **Spoonacular** — free tier, key at [spoonacular.com/food-api](https://spoonacular.com/food-api). Env var: `SPOONACULAR_API_KEY`.
- **UPCitemdb** — free trial tier, no key needed. Barcode-only, name-only fallback (no nutrition data) used as a last resort.
- **Edamam** / **Nutritionix** — also supported (`EDAMAM_APP_ID`/`EDAMAM_APP_KEY`, `NUTRITIONIX_APP_ID`/`NUTRITIONIX_APP_KEY`), but both now require a paid plan to sign up, so they're not part of the default setup.

## Tech

Vanilla HTML/CSS/JS, [Chart.js](https://www.chartjs.org/) for charts, no build step required. GitHub OAuth is handled by a few small Vercel serverless functions in `api/`.
