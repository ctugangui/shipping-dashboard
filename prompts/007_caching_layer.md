### Phase 7: Performance Engineering (Cache-Aside Pattern)

### The Architecture: "The Brain" (ShipmentService)
We are introducing a new layer.
*   **Old Flow:** Controller -> `UpsTrackingService` -> UPS API.
*   **New Flow:** Controller -> `ShipmentService` (The Brain) -> Check DB -> (If Stale) -> `UpsTrackingService` -> Save DB.

This isolates the "UPS" logic from the "General Shipping" logic.

***

### 🛑 Prerequisite: Get USPS Credentials

Before we ask Claude to write a single line of code, you must provision access.

1.  **Go to:** [USPS Developer Portal](https://developer.usps.com/)
2.  **Sign Up / Log In.**
3.  **Create an App:**
    *   Go to "My Apps" -> "Add App".
    *   **Callback URL:** You can use `http://localhost:3000/callback` (required field, even if we use Client Credentials).
    *   **API Products:** Select **"Tracking API"** (specifically the generic Tracking v3).
4.  **Copy Credentials:**
    *   **Consumer Key** (This is your Client ID).
    *   **Consumer Secret**.
5.  **Update `.env`:**
    Add these lines to your `.env` file next to your UPS keys:

```env
# USPS Config
USPS_CLIENT_ID="paste_your_consumer_key_here"
USPS_CLIENT_SECRET="paste_your_consumer_secret_here"
USPS_BASE_URL="https://api.usps.com"
```
*(Note: If you are given a specific Sandbox URL, use that. Otherwise, try the production URL. USPS is sometimes tricky with test environments).*

***

### CLAUDE PROMPT 007: Persistence & Caching Layer

**Role:** Senior Backend Architect
**Context:** We have a working `UpsTrackingService` that returns normalized data. We want to cache this data in SQLite to prevent rate limiting.
**Task:** Update the Prisma schema and implement a generic `ShipmentService` with Cache-Aside logic.

#### Step 1: Update `prisma/schema.prisma`
Add models to store the normalized shipment data.

```prisma
// ... existing SystemToken model ...

model Shipment {
  id                String          @id @default(uuid())
  trackingNumber    String          @unique
  carrier           String          // e.g., "UPS"
  status            String          // e.g., "TRANSIT", "DELIVERED"
  estimatedDelivery DateTime?
  currentLocation   String?
  updatedAt         DateTime        @updatedAt // Acts as our "Cache Timestamp"
  events            ShipmentEvent[]
}

model ShipmentEvent {
  id          String   @id @default(uuid())
  shipmentId  String
  shipment    Shipment @relation(fields: [shipmentId], references: [id], onDelete: Cascade)
  timestamp   DateTime
  location    String?
  description String
  status      String   // The normalized status code
}
```
*Run `npx prisma migrate dev --name init_shipment_cache` after updating.*

#### Step 2: Create `src/services/ShipmentService.ts`
This service manages the database and decides *when* to call the API.

**Logic Requirements:**
1.  **Constants:** `CACHE_TTL_MINUTES = 15`.
2.  **Method:** `getShipment(trackingNumber: string)`
3.  **The Flow:**
    *   **Attempt 1 (DB):** Query Prisma for the shipment (include `events`).
    *   **Validation:**
        *   If found AND `updatedAt` is within the last 15 minutes -> Return the DB object (mapped to `UnifiedShipment` interface).
        *   If found BUT status is `DELIVERED` -> Return DB object (Delivered packages don't change).
    *   **Attempt 2 (API):**
        *   Call `upsTrackingService.trackShipment(trackingNumber)`. (Note: We assume it's UPS for now. Later we can detect carrier by regex).
    *   **Persistence:**
        *   Use a Prisma transaction (`$transaction`).
        *   Upsert the `Shipment`.
        *   Delete existing `ShipmentEvents` for this ID (overwrite strategy).
        *   Create new `ShipmentEvents` from the API data.
    *   **Return:** The fresh `UnifiedShipment` object.

#### Step 3: Update `src/controllers/UpsController.ts`
*   Change the dependency: Import `shipmentService` instead of `upsTrackingService`.
*   The controller now calls `shipmentService.getShipment(trackingNumber)`.

**Deliverables:**
1.  Updated `prisma/schema.prisma`.
2.  `src/services/ShipmentService.ts`.
3.  Updated `src/controllers/UpsController.ts`.

***

### Instructions for User:
1.  **Execute Prompt:** Feed this to Claude.
2.  **Migration:** Run the migration command provided in the prompt.
3.  **The Cache Test:**
    *   **First Request:** `curl .../track/...` (Should take ~1-2 seconds, hits UPS).
    *   **Second Request:** Run the *exact same* command immediately. (Should take < 50ms, hits SQLite).
4.  **Report:** Let me know if you see the speed difference. That validates the cache.