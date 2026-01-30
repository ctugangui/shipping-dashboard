This is standard operating procedure in enterprise integrations. APIs are often gated, broken, or unavailable. A Senior Engineer doesn't stop; they **Mock it**.

### Phase 9: **Protocol: Mock Carrier**.

We will build a **"Local Courier"** integration.
*   **Goal:** Prove our system can handle multiple carriers (Polymorphism) and Cache-Aside logic *without* needing a working USPS key.
*   **How:** We will create a `LocalCourierService`. It will look and act *exactly* like the UPS service to our system, but internally it will just return fake data after a simulated delay.

This actually creates a better development experience for you, because you can test "Delivered", "Exception", and "Transit" states instantly by just changing the tracking number.

***

### CLAUDE PROMPT 009: The Mock Carrier (Polymorphism)

**Role:** Senior Backend Developer
**Context:** USPS keys are pending approval. We need to verify our multi-carrier architecture immediately.
**Task:** Implement a `LocalCourierService` to simulate a second carrier and integrate it into the main `ShipmentService`.

#### Step 1: Create `src/services/LocalCourierService.ts`
Implement a service that mimics a real API request.

**Requirements:**
1.  **Method:** `async trackShipment(trackingNumber: string): Promise<UnifiedShipment>`
2.  **Simulation Logic:**
    *   **Latency:** `await new Promise(r => setTimeout(r, 800));` (Simulate 800ms network lag).
    *   **Deterministic Responses:**
        *   If ID ends with `DEL`: Return status `DELIVERED`.
        *   If ID ends with `EXC`: Return status `EXCEPTION`.
        *   Else: Return status `TRANSIT`.
    *   **Data Structure:** Return a valid `UnifiedShipment` object with the carrier set to `'LOCAL_COURIER'` (or `'USPS'` if you want to pretend). Include dummy events.

#### Step 2: Update `src/services/ShipmentService.ts`
Modify the `getShipment` method to route traffic based on the Tracking Number format.

**Logic:**
*   **Regex Routing:**
    *   If tracking number starts with `1Z`: Use `upsTrackingService`.
    *   If tracking number starts with `LOC`: Use `localCourierService`.
    *   (Future) If starts with `9`: Use `uspsTrackingService`.
*   **Fallbacks:** If no pattern matches, throw "Unknown Carrier".

**Refactoring:**
*   Ensure the caching logic remains identical. The cache doesn't care *where* the data came from, only that it is a `UnifiedShipment`.

#### Step 3: Update `prisma/schema.prisma` (Optional)
*   Check if the `carrier` field in `CachedShipment` needs a specific enum. If it's a `String`, no changes needed.

**Deliverables:**
1.  `src/services/LocalCourierService.ts`
2.  Updated `src/services/ShipmentService.ts`

***

### Instructions for User:
1.  **Execute Prompt 009.**
2.  **The Polymorphism Test:**
    *   **Test A (Transit):** `curl http://localhost:3000/api/ups/track/LOC123456`
        *   *Expect:* Status `TRANSIT` (after ~800ms).
    *   **Test B (Delivered):** `curl http://localhost:3000/api/ups/track/LOC99999DEL`
        *   *Expect:* Status `DELIVERED`.
    *   **Test C (Cache):** Run Test A again.
        *   *Expect:* Instant response (< 30ms).
3.  **Report back:** Did the system successfully treat the "Local" courier just like UPS?