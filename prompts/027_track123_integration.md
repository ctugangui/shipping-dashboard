# Prompt 027: Track123 Aggregator Integration

**Role:** Backend Integration Engineer
**Context:** We are implementing an API Aggregator (Track123) to handle enterprise-gated carriers like OnTrac. The user has provided the exact API specifications.
**Goal:** Create `Track123Service.ts` as a fallback tracking provider and route OnTrac numbers to it.

# Requirements

## 1. Implement `Track123Service.ts`
* **File:** Create `src/services/Track123Service.ts`.
* **Interface:** Implement our standard `TrackingService` interface.
* **API Call:**
  * **Method:** `POST`
  * **URL:** `https://api.track123.com/gateway/open-api/tk/v2.1/track/query`
  * **Headers:** * `content-type: application/json`
    * `Track123-Api-Secret: ${process.env.TRACK123_API_SECRET}`
  * **Body:** The API requires an array of tracking number objects.
    `JSON.stringify({ trackNoInfos: [{ trackNo: trackingNumber }] })`
* **Response Parsing:**
  * Extract the data: `const content = data?.data?.accepted?.content?.[0];`
  * If `!content`, throw an error ("Package not found in Track123").
  * **Status Mapping:** Map `content.transitStatus`. If it equals `"DELIVERED"`, return `DELIVERED`. If it equals `"IN_TRANSIT"`, `"PICK_UP"`, or `"OUT_FOR_DELIVERY"`, return `IN_TRANSIT`. Otherwise, return `PROCESSING`.
  * **Location:** Try to extract the latest address from `content.localLogisticsInfo?.trackingDetails?.[0]?.address` (fallback to an empty string or "Unknown Location").

## 2. Register the Carrier (`src/services/ShipmentService.ts`)
* **Action:** Add `ontrac` (and `track123` as the provider) to the supported logic.
* **Routing Logic:** Add a regex for OnTrac numbers. They typically start with 1LS, C, D, or S, followed by alphanumerics. Use regex: `/^(1LS|C|D|S)[A-Z0-9]{10,}$/i`.
* **Execution:** If a tracking number matches the OnTrac regex, route it to `new Track123Service()`.

# Verification
1. Run `npm run build`.
2. Ensure `.env` has `TRACK123_API_SECRET`.
3. The user will click "Sync from Sheets" in the UI.
4. The system should successfully intercept the `1LSC...` numbers from the Google Sheet, route them to Track123, parse the `transitStatus`, and add them to the Kanban board!