# Prompt 024: USPS v3r2 Service Implementation

**Role:** Backend Integration Engineer
**Context:** We need to implement the USPS tracking service using their new v3r2 REST API. We already have the boilerplate pattern established by our `FedexTrackingService`.
**Goal:** Create `UspsTrackingService.ts` and integrate it into our unified tracking flow.

# Requirements

## 1. Credentials & Config
* **Environment:** Add these to `.env` (and use defaults for now):
  * `USPS_CLIENT_ID`
  * `USPS_CLIENT_SECRET`
  * `USPS_ENV` (default to `sandbox`)

## 2. Implement `UspsTrackingService.ts`
* **File:** Create `src/services/UspsTrackingService.ts`.
* **Action:** Create a private helper `getBaseUrl()`:
  * If `process.env.USPS_ENV === 'production'`, use `https://apis.usps.com`
  * Otherwise, use `https://apis-tem.usps.com`
* **OAuth2:** Implement a token fetch to `/oauth2/v3/token` using `client_credentials`. Cache the token in memory to avoid rate limits. If the fetch fails, throw an error.
* **Tracking Request:** Implement the POST request to `${getBaseUrl()}/tracking/v3r2/tracking`.
  * **Headers:** Include `Authorization: Bearer <token>` and `Content-Type: application/json`.
  * **Payload:** The API requires an array. Send: `JSON.stringify([{ trackingNumber: trackingNumberString }])`
* **Status Mapping:** Parse the USPS response. (If exact status codes are unknown, map generic "Delivered" text to `DELIVERED`, "In Transit" / "Out for Delivery" to `IN_TRANSIT`, and fallback to `PROCESSING`). Throw an error if the package is not found.

## 3. Register the Carrier
* **File:** `src/services/ShipmentService.ts`
* **Action:** * Add `usps` to the list of supported carriers.
  * Ensure the existing USPS regex logic correctly routes to the new `UspsTrackingService`.

# Verification
1. Run `npm run build` to ensure no TypeScript errors.
2. The user will attempt to track a USPS number. 
3. *Note:* Since the user is pending API scope approval from USPS, expect a 401/403 error. The goal is to verify that the app successfully attempts the OAuth flow and displays our red UI error banner if access is denied.