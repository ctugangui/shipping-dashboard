# Prompt 018: FedEx Environment Flags & UI Error Handling

**Role:** Full Stack Architect
**Context:** Our FedEx service hit production URLs with sandbox keys, causing a 403. We also realized that when the tracking service fails, the UI fails silently.
**Goal:** Implement environment-based URL routing for FedEx and add a global error banner to the dashboard.

# Requirements

## 1. Environment Configuration
* **Environment (`.env`):** Introduce a new variable `FEDEX_ENV`. (Default it to `sandbox` if not present).

## 2. Dynamic FedEx URLs (`src/services/FedexTrackingService.ts`)
* **Action:** Create a private helper method `getBaseUrl()`:
  * If `process.env.FEDEX_ENV === 'production'`, return `https://apis.fedex.com`
  * Otherwise, return `https://apis-sandbox.fedex.com`
* **Action:** Update the OAuth token and Tracking request logic to dynamically use this base URL instead of hardcoding it.
* **Critical Fix:** If the token fetch returns a non-200 status, `throw new Error(...)` immediately with the FedEx error message. Do not cache the token or proceed to the tracking API.

## 3. Backend: Catch Tracking Errors (`src/controllers/ViewController.ts`)
* **Action 1 (The POST Route):** In the `trackShipment()` method:
  * Wrap the `shipmentService.getShipment(...)` call in an `async try/catch` block.
  * *Success:* `reply.redirect('/')`
  * *Catch:* Log the error, extract the message, and redirect back to the homepage with the error in the query string: `reply.redirect('/?error=' + encodeURIComponent(error.message))`
* **Action 2 (The GET Route):** In the `home()` method:
  * Extract the error from the query string (`const error = req.query.error;`).
  * Pass this `error` variable down to the `reply.view('index', { ... })` context so the EJS template can read it.

## 4. Frontend: Display the Error Banner (`src/views/index.ejs`)
* **Action:** Near the top of the Kanban dashboard (below the search bar), check if `error` exists.
* **UI:** If it exists, display a Tailwind styled alert banner:
  * e.g., `<div class="bg-red-900/50 border border-red-500 text-red-200 px-4 py-3 rounded mb-6">`
  * Print the error message inside it.

# Verification
1. Run `npm run build` to ensure no TypeScript errors.
2. Set `FEDEX_ENV=sandbox` in your `.env`.
3. Track the test number `773831010328`.
4. If it fails (e.g., test number expired or auth issue), verify the red banner appears on the UI. If it succeeds, verify it appears in the Kanban board.