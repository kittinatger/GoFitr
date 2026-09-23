# GoFitr

**Try it live: [go-fitr-kittinat-gerdsri.vercel.app](https://go-fitr-kittinat-gerdsri.vercel.app)**

A simple, local-first fitness tracker. Sign in with Google, Apple, GitHub, or a local username/password, and your workout data stays in your browser's `localStorage` — nothing is synced to a server.

## Features

- Log in with Google, Apple, or GitHub (via Clerk), or create a local account (each account's data stays private on that device)
- Log workouts with multiple sets (reps × weight) and notes
- Dashboard with streak, weekly volume, and weekly/total workout counts
- Full workout history with per-exercise filtering
- Progress charts (max weight & volume over time) and personal records
- Body weight logging with a trend chart
- Nutrition tracking with a daily food log, calorie/macro goals, a built-in database of 500+ common foods (browsable by category or searchable), custom foods, saved meals, and bookmarked foods — all stored/served locally, no external APIs
- kg/lb unit toggle
- Export/import your data as JSON, or clear it entirely

## Running locally

Any static file server works, e.g.:

```bash
python -m http.server 8123
```

Then open `http://localhost:8123`. You can also just open `index.html` directly in a browser.

Note: this only serves the static files, so local username/password accounts work fine everywhere, and the social login buttons work too as soon as Clerk is configured (see below) — no serverless functions or Vercel deployment needed for auth, since Clerk handles it entirely from the browser.

## Social login setup (Clerk)

Google, Apple, and GitHub login go through [Clerk](https://clerk.com), run entirely from the client — there's no `api/` code involved.

1. Create a free app at [clerk.com](https://clerk.com).
2. In `index.html`, update the Clerk `<script>` tag's `data-clerk-publishable-key` and `src` (the domain in `src` is your app's Frontend API, shown on the Clerk dashboard). In `js/app.js`, update `CLERK_PUBLISHABLE_KEY` to match.
3. In the Clerk dashboard, under **User & Authentication → Social Connections**, enable Google, Apple, and GitHub. Clerk ships with shared development credentials for Google and GitHub, so they can work immediately in dev — for production you'll want to swap in your own OAuth client ID/secret for each.
4. Apple specifically needs your own Service ID/Team ID/Key ID/private key from the [Apple Developer portal](https://developer.apple.com/account/resources/identifiers/list/serviceId) (requires a paid Apple Developer account) even in Clerk, since Apple doesn't offer shared dev credentials.

Every button quietly shows a "not configured" toast instead of breaking anything until Clerk and that specific provider are set up.

## Nutrition data

There's no external food database or API — the Nutrition tab is fully local:

- **All Foods** — a built-in database of 1200+ common foods, drinks, desserts, and snacks, including well-known branded/packaged products (Pepsi, Lay's, Snickers, etc.), from around the world (`js/food-database.js`), browsable by category (Fruits, Vegetables, Fast Food, or specific cuisines like Mexican, Chinese, Japanese, Indian, African, Italian, etc.) or by typing to search.
- **Manual** — type in a food's name and macros by hand.
- **My Foods** — custom foods you've saved permanently (name + macros).
- **My Meals** — saved combinations of foods for one-tap re-logging.
- **Saved Foods** — anything you've bookmarked for quick re-adding.

Selecting a food from any of these opens a detail page (meal type, serving size, macros, and a full micronutrient breakdown) before it's added to the log.

The built-in database's values (including all micronutrients) are hand-authored from general nutrition knowledge, not sourced from a lab or live API — treat them as good approximations, not certified nutrition facts. This replaced an earlier version of the app that pulled from Open Food Facts, USDA, Nutritionix, Edamam, Spoonacular, and UPCitemdb, plus barcode scanning and an AI photo-estimate feature (Google Gemini) — all removed in favor of this curated, fully local dataset.

## Tech

Vanilla HTML/CSS/JS, [Chart.js](https://www.chartjs.org/) for charts, no build step required.
