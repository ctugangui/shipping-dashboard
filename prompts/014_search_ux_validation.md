# Prompt 014: Search UX Flow and Input Validation

**Role:** Frontend UX Developer
**Context:** We successfully upgraded to a Kanban dashboard, but our old search bar still behaves like a single-page lookup tool.
**Goal:** Integrate the search bar seamlessly with the Kanban board and add client-side validation.

# Requirements

## 1. Client-Side Validation (Frontend)
* **File:** `src/views/index.ejs`
* **Action:** Update the `<input>` field inside the search form.
* **Logic:**
  * Add the `required` attribute.
  * Add a `pattern` attribute to enforce the tracking number formats using Regex. 
    * UPS: Starts with `1Z` followed by 16 alphanumeric characters.
    * USPS: Starts with `94`, `93`, `92`, or `95` followed by 20-22 digits.
    * Local: Starts with `LOC` followed by any alphanumeric characters.
    * *Combined Regex:* `^(1Z[A-Z0-9]{16}|9[2-5][0-9]{20,22}|LOC[A-Z0-9]+)$`
  * Add a friendly `title` or `oninvalid` message explaining the required format if the user types something wrong.

## 2. Refactor the Tracking Flow (Frontend -> Backend)
* **File:** `src/views/index.ejs` and `src/routes/viewRoutes.ts` (or wherever the track route is).
* **Action:** We want a successful search to refresh the Kanban board, placing the newly tracked item into its proper column.
* **Option A (HTMX HX-Refresh):** * If the form still uses `hx-post="/track"`, update the backend controller for that route. Instead of returning the `partials/track` snippet, have the backend successfully fetch/cache the shipment, and then return an empty response with the HTMX header: `HX-Refresh: true`. This will tell the browser to instantly reload the dashboard, showing the new card in the correct column.
* **Option B (Standard Form):** * Remove HTMX from the search form (`hx-post`, `hx-target`, etc.). Make it a standard `<form action="/track" method="POST">`. Update the backend to `reply.redirect('/')` after successfully fetching and caching the shipment.

*Pick whichever option fits the current backend structure best, but ensure tracking a new package results in the user seeing the updated Kanban board with their new package.*

## 3. Clean Up Old Partials
* **Action:** If Option A or B makes the `src/views/partials/track.ejs` file obsolete (since we no longer render a single search result card standalone), you can safely delete that file.

# Verification Instructions
1. Try submitting a completely random string (e.g., "ABCD"). The browser should block the submission and show a validation error.
2. Submit a valid tracking number. The page should process the request and smoothly update/reload the Kanban board with the new shipment in the appropriate column.