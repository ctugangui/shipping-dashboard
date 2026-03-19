# Prompt 032: Auto-Archive and Global Search

**Role:** Full Stack Engineer
**Context:** The user has too many `DELIVERED` packages cluttering the main Kanban board. We need to auto-archive deliveries older than 7 days and introduce a global search bar.
**Goal:** Filter the main dashboard, build a dedicated `/archive` route with a table view, and add a search bar to the header.

# Requirements

## 1. Backend Data Filtering (`src/services/ShipmentService.ts`)
* **Action:** Create a method `getRecentShipments(searchQuery?: string)`.
* **Logic:** * If `searchQuery` is provided, return ALL shipments where the `trackingNumber` contains the query (case-insensitive).
  * If no search query, return all `PROCESSING` and `IN_TRANSIT` shipments, BUT only return `DELIVERED` shipments where `updatedAt` is within the last 7 days.
* **Action:** Create a method `getArchivedShipments()`.
* **Logic:** Return all `DELIVERED` shipments where `updatedAt` is strictly older than 7 days, ordered by `updatedAt` descending.

## 2. Controller Updates (`src/controllers/ViewController.ts`)
* **Action:** Update `renderDashboard(req, res)`.
* **Logic:** Read `const query = req.query.q as string;`. Call `shipmentService.getRecentShipments(query)` and pass the results to the `index.ejs` view.
* **Action:** Add a new method `renderArchive(req, res)`.
* **Logic:** Call `shipmentService.getArchivedShipments()` and render a new view called `archive.ejs`, passing the archived shipments. Add the GET `/archive` route to your router.

## 3. Frontend UI: Header & Search (`src/views/index.ejs`)
* **Action:** Update the top navigation area (where the title "Shipping Dashboard" and the Sync/Refresh buttons live).
* **Logic:** * Add a "View Archive" link styled like a subtle text button or secondary button.
  * Add a Search Bar: `<form action="/" method="GET" class="inline-flex"><input type="text" name="q" placeholder="Search tracking..." class="bg-gray-800 text-white rounded-l px-3 py-2 border border-gray-700 focus:outline-none"><button type="submit" class="bg-blue-600 px-3 py-2 rounded-r">Search</button></form>`.
  * If `req.query.q` exists, display a "Clear Search" link next to it.

## 4. Frontend UI: The Archive Page (`src/views/archive.ejs`)
* **Action:** Create `src/views/archive.ejs`. Use the same layout/header as `index.ejs`.
* **Logic:** * Add a "Back to Dashboard" button at the top.
  * Build a standard Tailwind CSS data table to display the archived shipments.
  * Columns: `Tracking Number`, `Carrier`, `Status`, `Location`, and `Last Updated`.
  * Make it look clean, with alternating row colors (or dark mode borders) matching our existing aesthetic.

# Verification
1. Run `npm run build`.
2. Open the dashboard. Older delivered packages should disappear from the Kanban board.
3. Search for a specific older package using the new Search Bar—it should successfully override the filter and display on the board.
4. Click "View Archive" and verify the older packages are listed in a clean table format.