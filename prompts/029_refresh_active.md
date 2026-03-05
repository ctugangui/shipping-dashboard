# Prompt 029: Refresh Active Shipments

**Role:** Backend API Engineer
**Context:** Our database now contains shipments in `PROCESSING` and `IN_TRANSIT` states. Because aggregators like Track123 take several minutes to scrape data after initial registration, we need a way to re-query active shipments to get their updated statuses.
**Goal:** Create a `/refresh` route that loops through all non-delivered shipments, queries their respective APIs, updates the database, and adds a UI button to trigger it.

# Requirements

## 1. Backend: Fetch Active Shipments (`src/services/ShipmentService.ts`)
* **Action:** Create a new method `getActiveShipments()`.
* **Logic:** Use Prisma to find all shipments where the status is NOT `DELIVERED`. Return this array.
* **Action:** Create a method `updateShipment(trackingNumber: string)`.
* **Logic:** Route the `trackingNumber` to the correct carrier service (FedEx, UPS, USPS, or Track123), fetch the live `UnifiedShipment` data, and use Prisma to update the existing database record (update status, location, and updated_at).

## 2. Implement the Refresh Route (`src/controllers/ViewController.ts`)
* **Action:** Add a new POST route method called `refreshActive()`.
* **Logic:** * Call `await shipmentService.getActiveShipments()`.
  * Loop through the results and call `await shipmentService.updateShipment(shipment.trackingNumber)` for each one.
  * *Crucial Throttle:* To avoid hitting API rate limits during bulk updates, add a 500ms delay between each API call: `await new Promise(r => setTimeout(r, 500));`
  * Redirect back to the homepage with a success message: `reply.redirect('/?success=' + encodeURIComponent('Refreshed all active shipments.'))`

## 3. Frontend: Add Refresh Button (`src/views/index.ejs`)
* **Action:** Next to the "Sync from Sheets" button, add a new button: `<form action="/refresh" method="POST" class="inline"><button type="submit" class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded">Refresh Active</button></form>`.

# Verification
1. Run `npm run build`.
2. The user will click the new "Refresh Active" button.
3. The app should fetch the active OnTrac packages (which have now had plenty of time to be scraped by Track123 in the background) and move them from Processing to Delivered!