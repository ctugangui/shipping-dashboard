# Prompt 017: FedEx Service Implementation

**Role:** Backend Integration Engineer
**Context:** We have UPS and Local tracking. We now have FedEx API credentials (API Key and Secret).
**Goal:** Create a `FedexTrackingService.ts` and integrate it into our unified tracking flow.

# Requirements

## 1. Credentials & Config
* **Environment:** Add these to `.env` (and use defaults for now):
  * `FEDEX_API_KEY`
  * `FEDEX_SECRET`
  * `FEDEX_ACCOUNT_NUMBER`
* **Note:** FedEx requires an OAuth2 token flow. We need to fetch a bearer token before each tracking request (or cache it for 1 hour).

## 2. Implement `FedexTrackingService.ts`
* **File:** Create `src/services/FedexTrackingService.ts`.
* **Logic:** * Implement the OAuth2 token exchange (`POST https://apis.fedex.com/oauth/token`).
  * Implement the tracking request (`POST https://apis.fedex.com/track/v1/trackingnumbers`).
  * **Status Mapping:** Map FedEx statuses to our `UnifiedShipmentStatus`:
    * `DL` (Delivered) -> `DELIVERED`
    * `IT` (In Transit), `OD` (Out for Delivery) -> `IN_TRANSIT`
    * Others -> `PROCESSING`

## 3. Register the Carrier
* **File:** `src/services/ShipmentService.ts`
* **Action:** * Add `fedex` to the list of supported carriers.
  * Update the regex logic to detect FedEx numbers (typically 12 or 15 digits).
  * Ensure `getShipment` calls the new `FedexTrackingService`.

## 4. Frontend Update
* **File:** `src/views/index.ejs`
* **Action:** Update the "Supported Formats" list in the UI to include:
  * **FedEx:** 12 or 15 digits.

# Verification
1. Run `npm run build` to ensure no TypeScript errors.
2. Enter a FedEx tracking number.
3. Verify it is fetched, saved to SQLite, and appears in the correct Kanban column.