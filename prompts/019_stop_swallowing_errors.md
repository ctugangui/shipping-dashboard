# Prompt 019: Fix Swallowed Tracking Errors

**Role:** Backend Debugger
**Context:** When FedEx returns "Not Found" for a tracking number, our `ShipmentService` creates a dummy "PROCESSING" shipment and caches it instead of throwing an error. Because it doesn't throw, the UI error banner from our last prompt never triggers.
**Goal:** Ensure tracking services throw explicit errors when a package isn't found, so the Controller can catch them and display the UI banner.

# Requirements

## 1. Throw on Not Found (FedEx Tracking)
* **File:** `src/services/FedexTrackingService.ts`
* **Action:** Inspect the tracking response logic. If the FedEx API response indicates the tracking number was not found (or if `No tracking info found` is logged), `throw new Error("Tracking number not found in FedEx system.")`. Do not return a dummy object.

## 2. Bubble up the Error (`ShipmentService`)
* **File:** `src/services/ShipmentService.ts`
* **Action:** Look at the `getShipment` method. If the underlying carrier service throws an error, or if it fails to resolve valid tracking data, do NOT create and cache a fallback `UnifiedShipment`. Ensure the error bubbles up (e.g., `throw error;`) so the `try/catch` block in `ViewController.ts` can catch it.

## 3. Database Cleanup
* **Action:** Use Prisma to delete all records from `cached_shipments` where the carrier is 'FEDEX' to clean up the dummy data from our previous tests. (e.g., run a quick CLI command or script: `npx prisma studio` is not needed, just execute the deletion).

# Verification
1. Run `npm run build`.
2. Ensure `.env` still has `FEDEX_ENV=sandbox`.
3. Track your real production number again (`398922026338`).
4. Because the sandbox won't find it, the service should now explicitly THROW.
5. The UI should instantly reload and display the red error banner with "Tracking number not found in FedEx system." The dashboard should NOT add a new card.