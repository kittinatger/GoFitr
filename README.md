# GoFitr

A simple, local-first fitness tracker that runs entirely in the browser — no backend, no sign-up. All data is stored in `localStorage`.

## Features

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

## Tech

Vanilla HTML/CSS/JS, [Chart.js](https://www.chartjs.org/) for charts, no build step required.
