# Prompt 011: The Pulse (Background Workers)

**Role:** Senior Backend Engineer
**Context:** We have a working Shipping Dashboard (Fastify/Prisma) with a UI.
**Goal:** Implement a background job that automatically refreshes the status of "Active" shipments.

# Architecture: The "Pulse"
We will use `fastify-cron` to schedule a recurring task.
* **Frequency:** Every 10 minutes.
* **Target:** Shipments in the SQLite database that are **NOT** `DELIVERED` or `CANCELLED`.
* **Safety:** Limit updates to 5 shipments per run to prevent API rate limiting.

# Requirements

## 1. Install Dependencies
* Install `fastify-cron`.

## 2. Create the Job (`src/jobs/refresh-shipments.job.ts`)
Create a new file for the cron logic.
* **Query:** Find up to 5 shipments where:
    * `status` is NOT IN ['DELIVERED', 'UNKNOWN'].
    * `updatedAt` is older than 30 minutes (don't over-fetch).
* **Action:** For each found shipment:
    * Call `ShipmentService.track(trackingNumber)`.
    * Log the result: `[Cron] Refreshed 1Z...: New Status: IN_TRANSIT`.
* **Error Handling:** If one fails, catch the error, log it, and continue to the next one. Do not crash the server.

## 3. Register the Plugin (`src/app.ts`)
* Register `fastify-cron` with the job.
* Schedule: `'*/10 * * * *'` (Every 10 minutes).

## 4. Verification Route (Temporary)
* Add a temporary GET route: `/api/cron/trigger` that manually invokes the job logic immediately.
    * *Why:* We don't want to wait 10 minutes to test if it works.

# Deliverables
1.  Updated `package.json`.
2.  `src/jobs/refresh-shipments.job.ts`.
3.  Updated `src/app.ts`.
4.  Updated `src/routes/index.ts` (for the manual trigger).

# Instructions for User Verification
1.  Run the manual trigger: `curl http://localhost:3000/api/cron/trigger`.
2.  Check logs to see `[Cron] Refreshed...`.