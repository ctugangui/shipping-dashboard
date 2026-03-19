# Prompt 033: Fix Archive Date Logic

**Role:** Backend Debugger
**Context:** The auto-archive logic is currently using the database's `updatedAt` timestamp. If an older package is newly synced, it incorrectly stays on the main dashboard because its `updatedAt` is today.
**Goal:** Refactor the Prisma queries in `ShipmentService.ts` to use `expectedDelivery` (the actual delivery date) for the 7-day calculation, falling back to `updatedAt` only if `expectedDelivery` is null.

# Requirements

## 1. Update `getRecentShipments`
* **File:** `src/services/ShipmentService.ts`
* **Action:** Modify the Prisma `where` clause for the non-search branch.
* **Logic:** The `DELIVERED` condition should require the package to be delivered within the last 7 days based on `expectedDelivery`. 
* **Prisma Structure:**
    where: {
      OR: [
        { status: { in: ['PROCESSING', 'IN_TRANSIT'] } },
        {
          status: 'DELIVERED',
          OR: [
            { expectedDelivery: { gte: sevenDaysAgo } },
            { expectedDelivery: null, updatedAt: { gte: sevenDaysAgo } }
          ]
        }
      ]
    }

## 2. Update `getArchivedShipments`
* **File:** `src/services/ShipmentService.ts`
* **Action:** Modify the Prisma `where` clause.
* **Logic:** Archive packages where `expectedDelivery` is strictly older than 7 days, falling back to `updatedAt` if null.
* **Prisma Structure:**
    where: {
      status: 'DELIVERED',
      OR: [
        { expectedDelivery: { lt: sevenDaysAgo } },
        { expectedDelivery: null, updatedAt: { lt: sevenDaysAgo } }
      ]
    }

# Verification
1. Run `npm run build`.
2. Open the dashboard. That UPS package from Feb 20 should immediately disappear from the main board and properly route to the Delivery Archive.