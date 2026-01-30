### Phase 4: The Tracking Logic

We will not bloat `UpsAuthService` with business logic. We will stick to the **Single Responsibility Principle**.
*   `UpsAuthService`: strictly manages the *keys* to the car.
*   `UpsTrackingService`: actually *drives* the car.

We need to implement the actual tracking lookup now.

***

### CLAUDE PROMPT 004: UPS Tracking Implementation

**Role:** Senior Backend Developer
**Context:** Auth is working. We now need to consume the UPS Tracking API.
**Task:** Create the `UpsTrackingService` and expose a tracking endpoint.

#### Step 1: Create `src/services/UpsTrackingService.ts`
This service depends on `UpsAuthService`.

**Requirements:**
1.  **Dependency:** Import the singleton `upsAuthService`.
2.  **Method:** `trackPackage(trackingNumber: string)`
3.  **Logic:**
    *   Call `await upsAuthService.getToken()`.
    *   Make a `GET` request to: `${process.env.UPS_BASE_URL}/track/v1/details/${trackingNumber}`.
    *   **Headers:**
        *   `Authorization`: `Bearer <token>`
        *   `transId`: `crypto.randomUUID()` (Unique ID for debugging)
        *   `transactionSrc`: `testing`
    *   **Response Handling:**
        *   If 200: Return the JSON body.
        *   If 404/Error: Throw a standard Error object with the message from UPS.
4.  **Export:** Export a singleton `upsTrackingService`.

#### Step 2: Update `src/controllers/UpsController.ts`
Add a new method `trackShipment`.
*   Extract `trackingNumber` from `req.params`.
*   Call `upsTrackingService.trackPackage(trackingNumber)`.
*   Return the result.

#### Step 3: Update `src/routes/upsRoutes.ts`
Add the new route.
*   `GET /track/:trackingNumber` -> binds to `UpsController.trackShipment`.

**Deliverables:**
1.  `src/services/UpsTrackingService.ts` code.
2.  Updates to Controller and Routes.

***

### Instructions for User:
1.  Paste **Claude Prompt 004** into the chat.
2.  **The Acid Test:**
    Once the server restarts, use this specific **UPS Sandbox Test Number** (standard 1Z format):
    `1Z12345E0205271688`

    Run this command:
    ```bash
    curl http://localhost:3000/api/ups/track/1Z12345E0205271688
    ```
3.  **Report back:**
    *   If successful, you will see a large JSON object starting with `{ "status": "OK", "provider": "UPS", "data": { "trackResponse": ... } }`.
    *   If it fails (500 or 404), paste the error message here.