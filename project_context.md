# Project Context: The Shipping Dashboard

## 1. Project Identity
* **Goal:** A "Vertical Slice" shipping dashboard (API + UI).
* **Philosophy:** "Spike & Stabilize". Functionality first, then tests/refinement.
* **Architecture:** Modular Monolith (Service-Controller-Route pattern).
* **Current Phase:** Background Jobs (The "Pulse").

## 2. Tech Stack (Non-Negotiable)
* **Runtime:** Node.js v22 LTS (Native `fetch`, `node:test`).
* **Language:** TypeScript 5.x+ (Strict Mode).
* **Framework:** Fastify v5+.
* **Database:** SQLite via Prisma ORM.
* **Frontend (SSR):** EJS (Templates), HTMX (Interactivity), Pico.css (Styling).
* **Background Jobs:** `fastify-cron`.

## 3. System Architecture

### Core Services
* **ShipmentService:** The "Brain". Orchestrates caching and carrier routing.
    * *Strategy:* Cache-Aside (Check DB -> If stale/missing, call API -> Save to DB).
    * *Polymorphism:* Routes `1Z...` to UPS, `LOC...` to LocalCourier.
* **UpsTrackingService:** Connects to Production UPS APIs (`onlinetools.ups.com`).
* **LocalCourierService:** Mock service for dev/testing.

### Data Model (`UnifiedShipment`)
* **Prisma Models:**
    * `SystemToken`: Persists OAuth credentials (auto-refreshing).
    * `CachedShipment`: Stores normalized shipment data (TTL 15 mins).

### The "Glass" Layer (Frontend)
* **Route:** `GET /` (Dashboard), `POST /partials/track` (HTMX Fragment).
* **Status:** ✅ Complete & Verified.
* **Features:** HTMX-driven search, Error handling, Visual history timeline.

## 4. Current State (Snapshot)
* ✅ **Backend Core:** Auth, Caching, and Routing are stable.
* ✅ **Polymorphism:** `ShipmentService` correctly handles UPS (Prod) and Local (Mock).
* ✅ **Frontend:** EJS/HTMX dashboard is live and verified against real UPS data.
* 🚧 **Active Task:** Implementing Background Jobs to auto-refresh active shipments.

## 5. File Structure (Key Directories)
```text
src/
├── app.ts                 # App entry point (Plugins: view, static, form, cron)
├── server.ts              # Server listener
├── config/                # Environment config
├── controllers/           # UpsController, ViewController
├── services/              # ShipmentService, UpsTrackingService, LocalCourierService
├── jobs/                  # Cron Jobs (New)
├── routes/                # viewRoutes, trackingRoutes
├── views/                 # EJS Templates (layouts, partials, index)
├── public/                # Static assets (css, images)
└── utils/                 # Mappers (upsMapper)
