# Prompt 023: Prevent Duplicate Tracking Numbers

**Role:** Full Stack UX Developer
**Context:** Our standard form tracks new packages. If a user accidentally enters a tracking number that is already in our SQLite database, we want to intercept it, prevent unnecessary API calls, and show a friendly warning.
**Goal:** Add a database check before tracking, and display a yellow warning banner on the UI if a duplicate is found.

# Requirements

## 1. Backend: Check for Existing Shipment (`src/services/ShipmentService.ts`)
* **Action:** Add a new public method called `shipmentExists(trackingNumber: string): Promise<boolean>`.
* **Logic:** Use Prisma to count or find records where the `trackingNumber` matches. Return `true` if it exists, `false` otherwise.

## 2. Backend: Intercept the Route (`src/controllers/ViewController.ts`)
* **Action 1 (The POST Route):** In `trackShipment()`, before calling `shipmentService.getShipment(...)`:
  * Check if `await shipmentService.shipmentExists(trackingNumber)` is true.
  * *If true:* `return reply.redirect('/?warning=' + encodeURIComponent('Tracking number already exists in your dashboard.'))`
* **Action 2 (The GET Route):** In `home()`:
  * Extract the warning from the query string (`const warning = req.query.warning;`).
  * Pass this `warning` variable down to the `reply.view('index', { ... })` context along with the existing `error` variable.

## 3. Frontend: Display the Warning Banner (`src/views/index.ejs`)
* **Action:** Right next to (or below) the existing red `error` banner check, add a new check for `warning`.
* **UI:** If `warning` exists, display a Tailwind styled alert banner using yellow/amber colors:
  * e.g., `<div class="bg-amber-900/50 border border-amber-500 text-amber-200 px-4 py-3 rounded mb-6">`
  * Print the warning message inside it.

# Verification
1. Run `npm run build` to ensure no TypeScript errors.
2. Go to the dashboard.
3. Pick a tracking number that is *already visible* on one of your Kanban cards.
4. Paste it into the search bar and hit "Track".
5. It should immediately reload and display the yellow warning banner without duplicating the card or hitting the carrier APIs.