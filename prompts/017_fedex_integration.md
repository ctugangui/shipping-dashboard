# Prompt 017: FedEx Service Implementation

**Role:** Backend Integration Engineer
**Context:** We have UPS and Local tracking. We now have FedEx API credentials (API Key and Secret).
**Goal:** Create a `FedexTrackingService.ts` and integrate it into our unified tracking flow.

# Requirements

## 1. Credentials & Config
* **Environment:** Add these to `.env` (and use defaults for now):
  * `FEDEX_API_KEY`
  * `FEDEX_SECRET`
  * `FEDEX_ACCOUNT_NUMBER` (if required by your payload)
* **Note:** FedEx requires an OAuth2 `client_credentials` token flow. Fetch a bearer token before the tracking request and cache it in memory for 50 minutes to avoid rate limits.

## 2. Implement `FedexTrackingService.ts`
* **File:** Create `src/services/FedexTrackingService.ts`.
* **Logic:** * Implement the OAuth2 token exchange (`POST https://apis.fedex.com/oauth/token`). *(Note: If auth fails, try `apis-sandbox.fedex.com` in case these are test keys).*
  * Implement the tracking request (`POST https://apis.fedex.com/track/v1/trackingnumbers`).
  * **Status Mapping:** Map FedEx statuses to our `UnifiedShipmentStatus`:
    * `DL` (Delivered) -> `DELIVERED`
    * `IT` (In Transit), `OD` (Out for Delivery) -> `IN_TRANSIT`
    * Others -> `PROCESSING`

## 3. Register the Carrier
* **File:** `src/services/ShipmentService.ts`
* **Action:** * Add `fedex` to the list of supported carriers.
  * Update the backend regex logic to detect FedEx numbers (typically 12, 15, or 20 digits, e.g., `^[0-9]{12,20}$`).
  * Ensure `getShipment` calls the new `FedexTrackingService`.

## 4. Frontend Update (Crucial)
* **File:** `src/views/index.ejs`
* **Action 1 (Validation):** Update the `<input>` `pattern` attribute to allow FedEx numbers. Append `|[0-9]{12,20}` to the existing regex so the browser allows submission.
* **Action 2 (UI Text):** Update the "Supported Formats" helper text list in the UI to include:
  * **FedEx:** 12 to 20 digits (e.g., 123456789012).

# Verification
1. Run `npm run build` to ensure no TypeScript errors.
2. Enter a FedEx tracking number.
3. Verify it is fetched, saved to SQLite, and appears in the correct Kanban column.