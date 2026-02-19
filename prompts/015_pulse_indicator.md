# Prompt 015: Global Sync Status Indicator

**Role:** Frontend & Backend Developer
**Context:** We have a background Cron job updating shipments. We want users to see a global "Last Synced" timestamp in the UI so they know the background worker is healthy.
**Goal:** Add a global "Live Sync" indicator to the dashboard header.

# Requirements

## 1. Backend: Calculate Last Sync Time
* **File:** `src/controllers/ViewController.ts`
* **Action:** In the `home()` method, calculate the most recent `updatedAt` timestamp from the fetched `cachedShipments`.
* **Logic:**
  * If there are shipments, find the one with the latest `updatedAt` date.
  * Pass this single `lastSynced` date object down to the EJS template (along with the existing `processing`, `inTransit`, and `delivered` arrays).
  * If there are no shipments, pass `null`.

## 2. Frontend: Add Header Indicator
* **File:** `src/views/index.ejs`
* **Action:** Update the top header section (where it says "Shipping Dashboard").
* **Layout:** Flex the header container so the title is on the left, and the new status indicator is on the right.
* **Status Indicator UI:**
  * Add a small, pulsing green dot (using Tailwind's `animate-pulse`, e.g., `<span class="relative flex h-3 w-3"><span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span><span class="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span></span>`).
  * Add text next to it: "System Active" (if `lastSynced` is null) OR "Last synced: [Formatted Time]" (if `lastSynced` exists).
  * Make the text small and a subtle color (`text-sm text-slate-400`).

# Verification
1. Run the build to check for TypeScript errors.
2. Load the dashboard. You should see a pulsing green dot in the header indicating the system is live, along with the timestamp of the most recent database update.