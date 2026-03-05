# Prompt 025: Google Sheets Ingestion & Automation

**Role:** Automation Engineer
**Context:** We have a Google Service Account JSON key (`google-credentials.json`) and a target `GOOGLE_SHEET_ID` in our `.env`. We want to build a feature that reads a specific column of tracking numbers from that sheet and automatically tracks any *new* numbers.
**Goal:** Create `GoogleSheetsService.ts`, add a `/sync` route, and create a "Sync Sheets" button on the UI.

# Requirements

## 1. Dependencies
* **Action:** Install the official Google APIs client: `npm install googleapis`

## 2. Implement `GoogleSheetsService.ts`
* **File:** Create `src/services/GoogleSheetsService.ts`.
* **Logic:** * Initialize the Google Auth client using the `GOOGLE_APPLICATION_CREDENTIALS` environment variable. Require the scope: `['https://www.googleapis.com/auth/spreadsheets.readonly']`.
  * Create a method `getTrackingNumbers()` that calls the Google Sheets API (`sheets.spreadsheets.values.get`).
  * For now, hardcode the range to read Column A (e.g., `Sheet1!A2:A`). Extract and return an array of strings containing the tracking numbers. (Filter out empty rows).

## 3. Implement the Sync Route
* **File:** `src/controllers/ViewController.ts`
* **Action:** Add a new POST route method called `syncSheets()`.
* **Logic:**
  * Fetch the array of tracking numbers from `GoogleSheetsService`.
  * Loop through the array. For each tracking number:
    * Check `await shipmentService.shipmentExists(number)`.
    * If it does NOT exist, call `await shipmentService.getShipment(number)` to fetch the data from the carrier and save it.
  * Keep a count of how many *new* numbers were successfully tracked.
  * Redirect back to the homepage appending a success message: `reply.redirect('/?success=' + encodeURIComponent(`Synced ${newCount} new packages from Google Sheets.`))`

## 4. Frontend: Add Sync Button & Success Banner
* **File:** `src/views/index.ejs`
* **Action 1 (Button):** Next to the main "Track" button (or in the header), add a secondary button: `<form action="/sync" method="POST" class="inline"><button type="submit" class="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded">Sync from Sheets</button></form>`.
* **Action 2 (Banner):** Check for the `success` query parameter (passed down from the Controller just like `error` and `warning`). If it exists, display a green Tailwind success banner at the top of the dashboard.

# Verification
1. Run `npm run build`.
2. Ensure `.env` has `GOOGLE_APPLICATION_CREDENTIALS` and `GOOGLE_SHEET_ID`.
3. The user will click the new "Sync from Sheets" button.
4. The backend should pull the numbers, skip duplicates, fetch new ones, and display the green success banner.