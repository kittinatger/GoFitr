# GoFitr

**Try it live: [go-fitr-kittinat-gerdsri.vercel.app](https://go-fitr-kittinat-gerdsri.vercel.app)**

A simple, local-first fitness tracker. Sign in with GitHub or a local username/password, and your workout data stays in your browser's `localStorage` — nothing is synced to a server.

## Features

- Log in with GitHub, or create a local account (each account's data stays private on that device)
- Log workouts with multiple sets (reps × weight) and notes
- Dashboard with streak, weekly volume, and weekly/total workout counts
- Full workout history with per-exercise filtering
- Progress charts (max weight & volume over time) and personal records
- Body weight logging with a trend chart
- kg/lb unit toggle
- Export/import your data as JSON, or clear it entirely

## Running locally

Any static file server works, e.g.:

```bash
python -m http.server 8123
```

Then open `http://localhost:8123`. You can also just open `index.html` directly in a browser.

Note: this only serves the static files, so local username/password accounts work fine, but "Continue with GitHub" needs the `api/` serverless functions (see below), which requires deploying to Vercel.

## GitHub login setup

"Continue with GitHub" is backed by serverless functions under `api/` and needs three environment variables set on the Vercel project:

- `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` — from a [GitHub OAuth App](https://github.com/settings/developers) with callback URL `<your-domain>/api/auth/github/callback`
- `SESSION_SECRET` — any long random string, used to sign the session cookie

## Tech

Vanilla HTML/CSS/JS, [Chart.js](https://www.chartjs.org/) for charts, no build step required. GitHub OAuth is handled by a few small Vercel serverless functions in `api/`.
