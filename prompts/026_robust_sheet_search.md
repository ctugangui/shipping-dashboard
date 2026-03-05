# Prompt 026: Dynamic Google Sheets Column Discovery

**Role:** Backend Automation Engineer
**Context:** Our `GoogleSheetsService` is failing with "Tracking column not found" because the sheet headers are not in the first row. The sheet has metadata in Row 1, and the actual headers (like "Tracking") are in Row 2.
**Goal:** Implement a dynamic 2D search algorithm to find the exact row and column of the target header, regardless of where it lives in the top section of the sheet.

# Requirements

## 1. Dynamic 2D Array Search (`src/services/GoogleSheetsService.ts`)
* **Action:** Refactor the column discovery logic in `getTrackingNumbers()`.
* **Logic:**
  * Define the target: `const targetHeader = process.env.GOOGLE_SHEET_TRACKING_COLUMN?.toLowerCase().trim();`
  * Create variables `let headerRowIndex = -1;` and `let trackingColumnIndex = -1;`
  * Loop through the first 10 rows of the sheet data (e.g., `for (let r = 0; r < Math.min(10, rows.length); r++)`).
  * Inside that loop, loop through the columns: `for (let c = 0; c < rows[r].length; c++)`.
  * Convert each cell to lowercase and trim it. If it matches `targetHeader`, set `headerRowIndex = r` and `trackingColumnIndex = c`, then break out of both loops.
  * If the loops finish and `trackingColumnIndex` is still `-1`, throw the error: `Tracking column not found in the sheet.`

## 2. Update Data Extraction Loop
* **Action:** Update the loop that extracts the actual tracking numbers so it dynamically starts on the row immediately after the header.
* **Logic:** The extraction loop should start at `let i = headerRowIndex + 1`.

## 3. Retain Aggressive Data Cleaning
* **Action:** Ensure the logic we built previously (splitting cells by newline `\n` and stripping out ` x 9` quantity suffixes) remains intact during the data extraction phase.

# Verification
1. Run `npm run build`.
2. The user will click "Sync from Sheets".
3. The backend should now scan row 1, skip it, find "Tracking" in row 2, and successfully extract the split tracking numbers from row 3 downwards.