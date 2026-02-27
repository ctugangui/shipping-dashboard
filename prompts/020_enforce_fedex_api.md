# Prompt 020: Fix FedEx Tracking API Payload & Headers

**Role:** API Integration Expert
**Context:** We successfully authenticated with FedEx Production, but a known valid tracking number is returning a "Not Found" or empty response. This indicates our POST payload or headers for the tracking request do not strictly match the FedEx v1 specification.
**Goal:** Refactor the tracking request in `FedexTrackingService.ts` to use the exact required nested JSON structure and headers.

# Requirements

## 1. Fix the Tracking Headers
* **File:** `src/services/FedexTrackingService.ts`
* **Action:** In the method that fetches the tracking data (e.g., `POST /track/v1/trackingnumbers`), ensure the headers strictly include:
  * `Authorization: Bearer <token>`
  * `Content-Type: application/json`
  * `X-locale: en_US` (This is often required by FedEx to return localized scan data).

## 2. Fix the Tracking Payload
* **Action:** Ensure the `body` of the POST request is stringified JSON that EXACTLY matches this structure:
  ```javascript
  {
    includeDetailedScans: true,
    trackingInfo: [
      {
        trackingNumberInfo: {
          trackingNumber: trackingNumberString // The variable containing the tracking number
        }
      }
    ]
  }
## 3. Improve Error Logging
* **Action: If the response.ok is false, or if the parsed JSON contains an errors array, log the ENTIRE raw JSON response from FedEx using console.error before throwing the generic "Not found" error. This will help us see if FedEx is complaining about something specific (like a missing carrier code).

# Verification
1. Run npm run build to ensure no syntax errors.
2. The user will test the exact same tracking number in the UI.
3. If it fails, the terminal should now print the exact FedEx JSON error response.