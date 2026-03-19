# Prompt 031: Fix Aggressive Data Cleaning Bug

**Role:** Backend Debugger
**Context:** Our Google Sheets data cleaner is too aggressive. It is accidentally truncating UPS tracking numbers that happen to contain an "X" followed by digits (e.g., `1ZR225X90377493582` gets chopped to `1ZR225`).
**Goal:** Refactor the quantity-stripping regex in `GoogleSheetsService.ts` so it only targets "x" modifiers at the end of a line that are preceded by a space.

# Requirements

## 1. Update the Cleaner Regex
* **File:** `src/services/GoogleSheetsService.ts`
* **Action:** Locate the `getTrackingNumbers()` method, specifically the loop where we clean the cell strings and remove the quantity suffixes (e.g., `" x 9"`).
* **Logic Fix:** Change the `.replace(...)` regex to strictly require whitespace before the "x" and anchor it to the end of the string. 
* **The New Regex:** Use `.replace(/\s+x\s*\d+$/i, '').trim()`
  * `\s+` ensures there must be at least one space before the "x" (preventing matches inside continuous tracking strings).
  * `x` matches "x" or "X" (with the `/i` flag).
  * `\s*` allows optional spaces after the "x".
  * `\d+` matches the quantity numbers.
  * `$` anchors this to the absolute end of the line/string.

# Verification
1. Run `npm run build`.
2. The user will trigger a manual UI sync.
3. The backend should now correctly parse `1ZR225X90377493582` in its entirety without chopping it, while still successfully cleaning `"1LSCXXH02491347 x 9"` down to `"1LSCXXH02491347"`.