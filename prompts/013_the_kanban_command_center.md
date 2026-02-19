# Prompt 013: Kanban Dashboard Implementation

**Role:** Full Stack Developer
**Context:** We have a working Fastify app that tracks packages and caches them in SQLite. Currently, the homepage only has a search bar.
**Goal:** Transform the homepage (`/`) into a 3-column Kanban-style dashboard that automatically loads and categorizes all saved shipments.

# Requirements

## 1. Backend: Update the Homepage Route
* **File:** Locate where the main `GET /` route is defined (likely `src/app.ts` or `src/routes/index.ts`).
* **Action:** * Import the Prisma client.
  * Fetch all cached shipments from the database (`prisma.unifiedShipment.findMany({ orderBy: { updatedAt: 'desc' } })`).
  * Group the shipments into three arrays based on their `status`:
    * `processing`: Statuses like 'UNKNOWN', 'LABEL_CREATED', 'PENDING' (or default fallback).
    * `inTransit`: Statuses like 'IN_TRANSIT', 'OUT_FOR_DELIVERY'.
    * `delivered`: Status 'DELIVERED'.
  * Pass these three grouped arrays down to the `index.ejs` template in the reply.

## 2. Backend: Add a Delete Route
* **Action:** Create a new route `DELETE /api/shipments/:id` (using the database ID).
* **Logic:** Use Prisma to delete the record from `UnifiedShipment`. Return a 200 success response.

## 3. Frontend: Redesign `index.ejs`
* **File:** `src/views/index.ejs`
* **Layout:**
  * Keep the existing Search Bar at the top.
  * Below the search bar, add a responsive CSS Grid: 1 column on mobile (`grid-cols-1`), 3 columns on medium/large screens (`md:grid-cols-3`). Add a gap (`gap-6`).
* **Columns (The Kanban Board):**
  * Create three distinct columns with subtle background colors (e.g., `bg-slate-800/50`, rounded corners, padding).
  * Column Headers: "Processing/Shipped", "In Transit", "Delivered".
* **Cards:**
  * Loop over the respective arrays (`processing`, `inTransit`, `delivered`) passed from the backend.
  * Render a Tailwind "Card" for each shipment.
  * Include: Carrier Icon/Text, Tracking Number (bold), Estimated Delivery Date, and Current Location.
  * Include a small "Remove" or "Archive" button (an `X` icon or text) in the top right of the card.
* **Client-Side JS:**
  * Add a tiny script block at the bottom of the EJS file to handle the "Remove" button clicks. It should make a `fetch` `DELETE` request to `/api/shipments/:id` and remove the card element from the DOM on success.

# Verification Instructions
1. Restart the server (or let the dev watcher restart it).
2. Load `http://localhost:3000`. You should immediately see the shipments you tracked in the last session placed in their correct columns.
3. Test the "Remove" button to ensure a card disappears and the database record is deleted.