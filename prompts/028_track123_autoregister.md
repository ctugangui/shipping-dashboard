# Prompt 028: Track123 Auto-Registration Flow

**Role:** Backend Integration Engineer
**Context:** Our `Track123Service` is successfully hitting the `/track/query` endpoint, but the API returns `"code":"A0400", "msg":"trackNo not registered"` for new OnTrac numbers. 
**Goal:** Update `Track123Service` to automatically register unknown tracking numbers before querying them.

# Requirements

## 1. Implement Auto-Registration
* **File:** `src/services/Track123Service.ts`
* **Action:** Update the tracking logic.
* **Logic:** 1. Make the initial POST request to `https://api.track123.com/gateway/open-api/tk/v2.1/track/query`.
  2. Inspect the response. Check if `data.rejected` exists and contains an error code `"A0400"` (trackNo not registered).
  3. **If A0400 occurs:** * Make a POST request to `https://api.track123.com/gateway/open-api/tk/v2.1/track/create` (or whatever the registration endpoint is according to standard Track123 docs).
     * Body format: `JSON.stringify({ trackNoInfos: [{ trackNo: trackingNumber }] })`
     * Await a successful registration (usually a 200 OK).
     * **Crucial:** Wait 1500ms (e.g., `await new Promise(r => setTimeout(r, 1500))`) to allow Track123 to fetch the data from OnTrac in the background.
     * Make the `/track/query` request one more time.
  4. Continue with the existing response parsing logic (mapping `transitStatus`, etc.).

## 2. Status Mapping Fix
* **Action:** Ensure the `transitStatus` mapping handles the specific string `"DELIVERED"` (which maps to our `DELIVERED` status) and `"IN_TRANSIT"` (which maps to `IN_TRANSIT`). 
* **Note:** The user's manual check on Track123 showed the carrier as "LaserShip" (which merged with OnTrac). Ensure our code doesn't hard-require the name "OnTrac" in the response.

# Verification
1. Run `npm run build`.
2. The user will click "Sync from Sheets" in the UI.
3. The logs should show `Track123Service` hitting the query endpoint, getting rejected, automatically registering the number, waiting briefly, querying again, and finally caching the data.