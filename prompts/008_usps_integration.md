### Phase 8: The Second Pillar (USPS)

We are not going to hook this into the main `ShipmentService` yet. First, we must build the "USPS Vertical" (Auth -> Service -> Mapper) and verify it works in isolation.

**Architecture Note:** We are strictly following the patterns established with UPS to maintain consistency.

### CLAUDE PROMPT 008: USPS Implementation

**Role:** Senior Backend Developer
**Context:** We need to add USPS support. We already have a working UPS implementation.
**Task:** Implement `UspsAuthService`, `UspsTrackingService`, and `uspsMapper` following the existing patterns.

#### Step 1: Update `prisma/schema.prisma`
We need to store USPS tokens separately because they have different expiration times.
*   Update the `SystemToken` model comments or logic if necessary (or just ensure the `provider` field can handle "USPS"). *Note: Since `provider` is a String, no schema change is strictly required, just run `npx prisma generate` to be safe.*

#### Step 2: Create `src/services/UspsAuthService.ts`
Implement the OAuth flow for USPS.
*   **Endpoint:** POST `${USPS_BASE_URL}/oauth2/v3/token`
*   **Headers:** `Content-Type: application/json` (Note: USPS might use JSON body for creds, or Basic Auth. Check standard OAuth Client Credentials flow. Usually: `grant_type='client_credentials'`, `client_id`, `client_secret`).
*   **Logic:** Same "Check DB -> Fetch -> Save" flow as UPS.
*   **Provider Name:** "USPS".

#### Step 3: Create `src/utils/uspsMapper.ts`
Create a normalization function.
*   **Input:** Raw USPS JSON.
*   **Output:** `UnifiedShipment` (the interface we created in Phase 5).
*   **Mapping:**
    *   Map USPS status strings to our standard enums (e.g., "Delivered" -> "DELIVERED").
    *   Extract events array.

#### Step 4: Create `src/services/UspsTrackingService.ts`
*   **Dependency:** `uspsAuthService`.
*   **Method:** `trackShipment(trackingNumber)`.
*   **Endpoint:** GET `${USPS_BASE_URL}/tracking/v3/tracking/${trackingNumber}`.
*   **Return:** Normalized `UnifiedShipment`.

#### Step 5: Temporary Verification Route
*   Update `src/controllers/UpsController.ts` (or create a temporary `UspsController`) to expose `GET /api/usps/track/:id`.
*   We just want to test this in isolation before merging it into the main logic.

**Deliverables:**
1.  `UspsAuthService.ts`
2.  `uspsMapper.ts`
3.  `UspsTrackingService.ts`
4.  Temporary Route for testing.

***

### Instructions for User:
1.  **Get your Keys** and update `.env`.
2.  **Execute Prompt 008.**
3.  **The Acid Test:**
    *   Find a USPS Tracking number (e.g., `9300120111411202392700` is a classic test number, or find a real one from a recent Amazon order).
    *   Run: `curl http://localhost:3000/api/usps/track/<your_tracking_number>`
4.  **Report back** with the JSON response (or error).