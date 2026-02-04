# Context
We are the "Shipping Architect" and "Builder" team.
We have a Fastify/TypeScript backend that normalizes UPS and Local courier data into a `UnifiedShipment` object.
We are now building the "Glass" layer—a lightweight UI to visualize this data.

# Goal
Implement a Server-Side Rendered (SSR) frontend using EJS and HTMX.
The UI should be minimal (using Pico.css) and allow tracking a package without a full page reload.

# Tech Stack Constraints
- Framework: Fastify v5
- Templating: `@fastify/view` with `ejs`
- Static Files: `@fastify/static`
- CSS: Pico.css (via CDN)
- Interactivity: HTMX (via CDN)
- NO React, NO Vue, NO Build Steps (Webpack/Vite).

# Architecture & Files
1. **Dependencies**: Install `ejs`, `@fastify/view`, `@fastify/static`.
2. **Structure**:
   - `src/views/layouts/main.ejs`: Base HTML shell with HTMX/Pico CDNs.
   - `src/views/partials/shipment-card.ejs`: Displays the `UnifiedShipment` data (Status, ETA, Location).
   - `src/views/index.ejs`: The main dashboard containing the search form.
   - `src/controllers/view.controller.ts`: New controller.
   - `src/routes/view.routes.ts`: New routes.

# Requirements

## 1. Configuration (`app.ts`)
- Register `@fastify/view`:
  - Point to `src/views`.
  - Ensure `view` is available on the Fastify instance.
- Register `@fastify/static`:
  - Point to `src/public`.
  - Prefix: `/public/`.

## 2. The View Controller (`view.controller.ts`)
- **Action `home`**: Renders `index.ejs`.
- **Action `trackFragment`**:
    - Extract `trackingNumber` from `req.body`.
    - **Crucial:** Call `ShipmentService.track(trackingNumber)`.
    - Return `reply.view('partials/shipment-card.ejs', { shipment })`.
    - **Error Handling:** If an error occurs (e.g., 404 or API fail), return a small HTML snippet `<div class="pico-background-red-200">Error: [Message]</div>` so the user sees it in the UI immediately.

## 3. The Dashboard (`index.ejs`)
- Inherit from `layouts/main.ejs` (or include it).
- **Search Form:**
  - Use HTMX attributes: `hx-post="/partials/track"`, `hx-target="#result-area"`, `hx-swap="innerHTML"`.
  - Include an indicator: `hx-indicator="#loading"`.
  ```html
  <article>
      <header>Tracking Dashboard</header>
      <form hx-post="/partials/track" hx-target="#result-area" hx-swap="innerHTML">
          <input type="text" name="trackingNumber" placeholder="Enter 1Z... or LOC..." required>
          <button type="submit">Track Package</button>
      </form>
      <div id="loading" class="htmx-indicator">Searching carrier networks...</div>
      <div id="result-area">
          </div>
  </article>