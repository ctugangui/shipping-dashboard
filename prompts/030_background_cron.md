# Prompt 030: Background Cron Automation

**Role:** Backend Automation Engineer
**Context:** The user currently has to manually click "Sync from Sheets" and "Refresh Active" in the UI. We want to automate these tasks using `node-cron` so they run completely in the background.
**Goal:** Extract the execution logic into reusable service methods and schedule them with `node-cron`.

# Requirements

## 1. Dependencies
* **Action:** Install the cron library and its types: `npm install node-cron` and `npm install -D @types/node-cron`.

## 2. Refactor Logic for Background Execution
* **File:** `src/services/ShipmentService.ts`
* **Action:** Create two new methods that abstract the loop logic currently sitting in `ViewController`.
* **Method 1 (`runSheetSync`):** * Fetch numbers from `GoogleSheetsService`. Loop through them. Skip if `shipmentExists()`. If new, `getShipment()` and save. Return the count of new shipments. (Wrap the whole thing in a `try/catch` so background errors don't crash the server, logging errors to the console).
* **Method 2 (`runActiveRefresh`):** * Fetch `getActiveShipments()`. Loop through them. Wait `500ms` between each. Call `updateShipment()`. Return the count of updated shipments. (Wrap in `try/catch`).
* **Update `ViewController`:** Refactor the `/sync` and `/refresh` routes to simply call these new methods instead of doing the looping themselves.

## 3. Implement the Cron Scheduler
* **File:** Create `src/jobs/cron.ts`.
* **Action:** Export a function `startCronJobs(shipmentService: ShipmentService)`.
* **Logic:** * Import `node-cron`.
  * **Job 1 (Sync Sheets):** Schedule to run every 30 minutes (`'*/30 * * * *'`). Inside the callback, `console.log('[Cron] Starting scheduled sheet sync...');` and call `await shipmentService.runSheetSync();`.
  * **Job 2 (Refresh Active):** Schedule to run every hour (`'0 * * * *'`). Inside the callback, `console.log('[Cron] Starting scheduled active refresh...');` and call `await shipmentService.runActiveRefresh();`.

## 4. Boot the Scheduler
* **File:** `src/server.ts` (or `app.ts` wherever your server starts).
* **Action:** Import `startCronJobs`. Right after your server successfully listens on port 3000, call `startCronJobs(shipmentService)` to kick off the background timers.

# Verification
1. Run `npm run build`.
2. Start the server. The terminal should indicate that cron jobs have been initialized.
3. The manual UI buttons should still work perfectly when clicked, proving the refactor was successful.