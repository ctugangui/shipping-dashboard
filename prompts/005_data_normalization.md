### Phase 5: The Adapter Pattern (Data Normalization)

We need to convert the raw, messy UPS JSON into a **Unified Shipment Format**. This ensures our frontend (and database) only speaks *one* language, regardless of whether the package is UPS, FedEx, or USPS.

***

### CLAUDE PROMPT 005: Data Normalization (The Adapter)

**Role:** Senior Software Architect
**Context:** We are successfully fetching raw UPS tracking data.
**Task:** Implement the "Adapter Pattern" to normalize this data into a standard format.

#### Step 1: Define the Standard Interface
Create `src/types/UnifiedShipment.ts`. This will be the contract for *all* carriers.

```typescript
export interface ShipmentEvent {
  timestamp: string; // ISO String
  location: string;
  description: string;
  status: string; // e.g., "DEPARTURE", "ARRIVAL"
}

export interface UnifiedShipment {
  trackingNumber: string;
  carrier: 'UPS' | 'USPS' | 'FEDEX';
  status: 'TRANSIT' | 'DELIVERED' | 'EXCEPTION' | 'UNKNOWN';
  estimatedDelivery: string | null; // ISO String
  currentLocation: string | null;
  events: ShipmentEvent[];
  raw?: any; // Optional: Keep raw data for debugging
}
```

#### Step 2: Create the Mapper
Create `src/utils/upsMapper.ts`.
This file acts as a pure function. It takes the ugly UPS JSON and returns a `UnifiedShipment`.

*   **Logic:**
    *   Navigate the deep UPS structure (`trackResponse.shipment[0].package[0]...`).
    *   Map UPS status codes (e.g., "D" -> "DELIVERED", "I" -> "TRANSIT").
    *   Format timestamps to ISO strings.
    *   Handle edge cases (missing dates, missing location).

#### Step 3: Integrate into Service
Modify `src/services/UpsTrackingService.ts`.
*   Import the `normalizeUpsResponse` function from the mapper.
*   Update `trackShipment` to return `Promise<UnifiedShipment>`.
*   Pass the raw API response through the mapper before returning it.

**Deliverables:**
1.  `src/types/UnifiedShipment.ts`
2.  `src/utils/upsMapper.ts`
3.  Updated `src/services/UpsTrackingService.ts`

***

### Instructions for User:
1.  Execute **Claude Prompt 005**.
2.  **The Validation:**
    *   Restart the server.
    *   Run the same curl command: `curl http://localhost:3000/api/ups/track/1Z12345E0205271688`
3.  **The Result:**
    *   You should now see a **clean, flat JSON** response instead of the nested UPS nightmare.
    *   It should look like:
        ```json
        {
          "status": "OK",
          "provider": "UPS",
          "data": {
            "trackingNumber": "1Z...",
            "carrier": "UPS",
            "status": "DELIVERED",
            ...
          }
        }
        ```
4.  Report back when you see the "Clean Data".