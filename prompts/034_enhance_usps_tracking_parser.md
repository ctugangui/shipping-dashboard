# Prompt 034: Enhance USPS Tracking Parser

**Role:** Backend API Engineer
**Context:** Our `UspsTrackingService` is successfully determining the tracking status, but it is failing to extract the delivery date (`expectedDelivery`) and the `location` (City, State) from the USPS API response. As a result, the UI cards for USPS are missing vital data compared to FedEx/UPS.
**Goal:** Refactor the JSON parsing logic in `UspsTrackingService.ts` to fully map the location and date fields.

# Requirements

## 1. Extract Location & Date
* **File:** `src/services/UspsTrackingService.ts`
* **Action:** Locate the `getShipment(trackingNumber)` method where we parse the USPS API response.
* **Logic:** The USPS API typically returns a `trackingInfo` object with an array of tracking events. 
  * Safely extract the most recent event's city and state (e.g., `eventCity` and `eventState`). Combine them into a string for the `location` field (e.g., `"BEAVERTON, OR"`). If not found, default to `"Unknown Location"`.
  * Safely extract the delivery date or the timestamp of the latest event. Convert this to a standard JavaScript `Date` object and assign it to `expectedDelivery`. 

## 2. Populate the UnifiedShipment
* **Action:** Ensure the returned `UnifiedShipment` object contains these mapped values instead of `null` or hardcoded empty strings.
  * `location: extractedLocation`
  * `expectedDelivery: extractedDate`

## 3. Fallback/Logging
* **Action:** If the structure of the USPS response is different than expected, add a temporary `console.log` of the raw USPS API response data inside the `catch` block or before parsing, so we can inspect the exact JSON keys if it fails.

# Verification
1. Run `npm run build`.
2. The user will trigger a manual UI sync or click "Refresh Active".
3. The USPS cards on the dashboard should now beautifully render the red location pin (e.g., "BEAVERTON, OR") and the calendar icon with the actual delivery date, matching the UPS and FedEx cards.