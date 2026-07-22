# NutriAI

A polished, local-first nutrition tracker built as a portfolio project. NutriAI turns a one-shot Gemini photo demo into a complete product flow: personalized onboarding, daily targets, editable meal logging, barcode lookup, water and weight tracking, streaks, and AI meal planning.

## What changed

- Product-style onboarding with Mifflin-St Jeor calorie and macro targets
- Daily dashboard with calorie budget, macro progress, diary, water, weight, and streaks
- One correction flow for photo, text, manual, barcode, and plan entries
- Client-side barcode scanning with Open Food Facts
- AI daily plan generation through a stateless Cloudflare Worker
- Local-first persistence, plus JSON backup import/export
- Graceful manual fallback when AI limits are reached
- Responsive mobile navigation and desktop two-column layout

## Architecture

The browser stores the profile and diary in `localStorage`. Images and descriptions are sent transactionally to a stateless Cloudflare Worker, which calls Gemini and returns JSON. The Worker does not cache requests. Open Food Facts is queried directly after a barcode is decoded in the browser.

This is good for a portfolio demo and zero-cost prototyping. It is not a substitute for professional dietary advice, and browser storage is not the right final architecture for regulated health data.

## Files

- `index.html`: React, Babel, and barcode scanner bootstrapping
- `NutriAI.jsx`: complete product UI and local-first logic
- `Worker.js`: Gemini analysis and meal-plan routes

## Run locally

Serve the folder over HTTP, rather than opening `index.html` directly:

```bash
python -m http.server 8080
```

Open `http://localhost:8080`.

## Deploy

1. Publish the frontend with GitHub Pages.
2. Create a Cloudflare Worker and paste `Worker.js`.
3. Add `GEMINI_API_KEY` as a Worker secret.
4. Optionally set `ALLOWED_ORIGINS` to your GitHub Pages URL.
5. Replace `WORKER_URL` in `NutriAI.jsx` with the deployed Worker URL.

## Notes

Open Food Facts asks API clients to identify themselves. Browsers do not allow JavaScript to set the `User-Agent` header, so the frontend uses the permitted `X-OpenFoodFacts-Client` header and a descriptive query. For production, proxy those requests and follow the current Open Food Facts API guidance.

Built for demonstration and learning. Not affiliated with Cal AI or Open Food Facts.
