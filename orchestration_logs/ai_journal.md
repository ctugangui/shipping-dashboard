Project Log: Shipping Dashboard
Tuesday, January 13, 2026
Core Window: 10:00 - 13:00

1. Project Initialization & Infrastructure
    * Technical Setup: Scaffolding completed using Node.js v22 (LTS) with ES Modules.

* Architecture Pattern: Established a Service-Controller-Route (SCR) pattern to decouple business logic for carriers (UPS/USPS) from API routes.

* Environment Control: .env and .gitignore configured to professional security standards to prevent credential leakage.

* GitHub Integration: Repository initialized and linked; successfully resolved a git rebase conflict to synchronize local and remote histories.

2. Database & Data Integrity
* Provider Choice: Initialized SQLite via Prisma ORM for a lightweight local footprint on the Mac mini.

* Schema Design: Defined core relational models:

    * PurchaseOrder: Business logic and order tracking.

    * Shipment: Logistics mapping.

    * TrackingDetail: Historical state management.

* Migration Milestone: Successfully executed the first Prisma migration (init).

3. AI Orchestration
* Workflow Audit: Leveraged a dual-model AI workflow using Gemini (Architect) for design and Claude (Builder) for implementation.

* Documentation: Established this Markdown log to demonstrate senior-level competence in AI-assisted development and project management.

Next Session Goal: Implement the UPSService.js module to handle OAuth 2.0 authentication and fetch real-time tracking data from the UPS API.




## [2026-01-24] Phase: Architecture Reset (The "Scorched Earth" Protocol)

### 1. The Challenge
We initially started with JavaScript for speed, but as the data model grew (relationships between POs and Shipments), the lack of type safety became a liability.

### 2. The Decision (Architect Role)
Decided to pivot to **TypeScript** and **Node.js v22**. Rather than migrating files incrementally, we chose a "Scorched Earth" approach—nuking the legacy JS code to rebuild a clean TypeScript/Fastify scaffold.

### 3. The AI Workflow
* **Architect (Gemini):** Defined the new `tsconfig` standards (ES2022, NodeNext) and the Service-Controller pattern.
* **Builder (Claude):** Generated the boilerplate code for the new scaffold based on the Architect's specs.
* **Human Review:** Verified the server boot sequence and enforced strict environment variable validation.

### 4. Key Takeaway
Paying down technical debt early (switching to TS) prevents "ghost bugs" later in the project.









## [2026-01-24] Phase: Foundation & Authentication Strategy

### 1. The Challenge
With the project reset to a clean TypeScript/Fastify state ("Scorched Earth"), the immediate hurdle was integrating the UPS API.
*   **Problem:** The UPS OAuth 2.0 flow requires a fresh token for requests.
*   **Risk:** During development (hot-reloading), the server restarts frequently. If we fetch a new token on every boot, we risk hitting UPS API rate limits or getting the IP banned.

### 2. The Decision (Architect Role)
We rejected an in-memory token strategy. Instead, we architected a persistence layer using **Prisma + SQLite**.
*   **Schema:** Introduced a `SystemToken` model to store the encrypted Access Token and its `expiresAt` timestamp.
*   **Logic:** The Service layer (`UpsAuthService`) acts as a singleton. It checks the DB first; if a valid token exists, it reuses it. It only fetches a new token if the current one is expired or missing.
*   **Constraint:** Strictly using native Node.js `fetch` (no Axios) to reduce bundle size and dependencies.

### 3. The AI Workflow
*   **Architect:** Defined the "Check-DB-First" logic flow and the Prisma schema for `SystemToken`.
*   **Builder (Claude):** Tasked with implementing the Service class with strict TypeScript interfaces for the UPS OAuth response.
*   **Human:** Managed the migration (`npx prisma migrate`) and verified the token persistence logic.

### 4. Outcome
A robust authentication foundation that survives server restarts and respects 3rd-party API limits.

## [2026-01-24] Phase: The "First Handshake" (UPS Integration)

### 1. The Goal
Establish a secure, persistent connection with the UPS API.
*   **Target:** A working endpoint `/api/ups/status` that returns a valid 200 OK signal from UPS.
*   **Constraint:** Must use the `SystemToken` architecture (SQLite persistence) to avoid re-authenticating on every server restart.

### 2. The Workflow
*   **Architect (Gemini):** Designed the `UpsAuthService` logic (Singleton pattern, native `fetch` only).
*   **Builder (Claude):** Generated the Service, Controller, and Route layers.

### 3. Friction Points (Human-in-the-Loop)
*   **AI Hallucination:** Claude claimed to have created `UpsController.ts` in one iteration, but the file was missing from the file system. I had to intervene and force the file creation.
*   **Migration State:** Ran into Prisma migration conflicts when adding the `SystemToken` model. Resolved by clearing the dev SQLite file and re-running the migration to ensure a clean schema state.
*   **Environment Validation:** The initial smoke test failed because we were using placeholder keys. I had to provision real UPS CIE (Sandbox) keys to pass the logic gates.

### 4. The Outcome
**Success.** The "Acid Test" passed.
We successfully hit `GET /api/ups/status`, which triggered the internal Service to:
1.  Check the DB (Token missing).
2.  Authenticate with UPS (OAuth 2.0).
3.  Save the new token to SQLite.
4.  Return "Token is valid".

**Next Steps:** Implement the actual Tracking logic now that the auth pipe is clear.

## [2026-01-27] Phase: Standardization & Quality Assurance

### 1. The Challenge
Raw data from carrier APIs (UPS) is deeply nested, cryptic ("status: D"), and vendor-specific. Building a UI directly against this creates tight coupling; if we switch to USPS, the UI breaks.

### 2. The Decision (Architect Role)
Implemented the **Adapter Pattern**.
*   **Unified Interface:** Created `UnifiedShipment` type to enforce a standard contract for all carriers.
*   **Mapper Logic:** Built a pure function to transform UPS JSON -> Unified Object.
*   **Testing Strategy:** Rejected Jest (bloated) in favor of the **Node.js Native Test Runner**. This kept dependencies zero and boot times instant.

### 3. The Outcome
*   **Test Coverage:** Achieved 100% coverage on the normalization logic (9/9 tests passed).
*   **Architecture:** The core system is now agnostic to the data provider. The Controller returns standard data, regardless of the messy API source.

## [2026-01-27] Phase: Performance Engineering (Cache-Aside Pattern)

### 1. The Challenge
External APIs (UPS) are slow (~400ms) and rate-limited. Relying on real-time fetching for a dashboard is unscalable; refreshing the page 10 times results in 10 redundant API calls.

### 2. The Decision (Architect Role)
Implemented a **Cache-Aside Strategy** using SQLite/Prisma.
*   **Schema:** Introduced `CachedShipment` models to store normalized data, separated from core business logic to avoid domain pollution.
*   **Logic:** The `ShipmentService` acts as the gatekeeper.
    1.  Checks DB first.
    2.  If data is fresh (< 15 mins), return immediately.
    3.  If stale/missing, fetch upstream, normalize, and upsert to DB.
*   **Constraint:** Used atomic transactions (`$transaction`) to ensure shipment details and events are updated simultaneously.

### 3. The Outcome
*   **Performance:** Reduced API latency from **435ms** (Cold) to **28ms** (Warm).
*   **Reliability:** The system is now resilient to upstream API outages for recently viewed packages.

## [2026-01-29] Phase: Polymorphism & The Mock Pivot

### 1. The Challenge
We attempted to integrate **USPS Tracking**. However, the USPS v3 API credentials provided "Public Access" but lacked the specific `tracking` scope required to fetch data, returning `401 Unauthorized`. Waiting for USPS support would stall the project.

### 2. The Decision (Architect Role)
Executed **Protocol: Mock Carrier**.
*   **Strategy:** Instead of waiting for keys, we implemented a `LocalCourierService` that mimics the USPS/Carrier interface.
*   **Routing Logic:** Updated `ShipmentService` to inspect the tracking number prefix:
    *   `1Z...` -> Routes to `UpsTrackingService`
    *   `LOC...` -> Routes to `LocalCourierService`
*   **Simulation:** The Mock service simulates network latency (800ms) and deterministic states (DELIVERED, EXCEPTION) based on the tracking number suffix.

### 3. The Outcome
*   **Architecture Verified:** The system proved it can handle multiple carriers seamlessly.
*   **Caching Validated:** `LocalCourier` requests are cached identically to UPS requests (27ms warm response vs 800ms cold).
*   **Unblocked:** Frontend development can proceed using `LOC` numbers to test various UI states without needing real packages.


## [2026-02-03] Phase: The Migration & The Glass Layer

**Phase:** Frontend Spike ("Option A")
**Tools:** Gemini (Architect) + Cline (Builder)

### 1. The Challenge
We needed to visually verify our normalized data (the "Glass Layer") but lacked a UI. Simultaneously, we migrated our workflow from the Claude Web UI to **Cline** (VS Code) to gain direct file system control, which introduced new workflow constraints regarding token costs and context management.

### 2. The Decision (Architect Role)
* **Architecture:** Implemented **Server-Side Rendering (SSR)** using `EJS` and `HTMX`. This avoided React complexity while enabling "Click-to-Load" interactivity without full page reloads.
* **Workflow:** Adopted the **"Sniper Method"** with Cline (one specific task per chat session) to keep context windows small and costs low (~$3.00 for the full build).

### 3. Execution & Technical Hurdles
We encountered and resolved three distinct categories of blockers during the implementation:
* **Protocol Error (415):** Fastify rejected HTMX form submissions (`application/x-www-form-urlencoded`).
    * *Fix:* Architected and installed the `@fastify/form` plugin to handle standard HTML payloads.
* **Environment Locks:** The server port (3000) became locked by "Zombie" background processes during the migration.
    * *Fix:* Utilized `lsof -ti :3000 | xargs kill -9` to force-clear the port.
* **Data Integrity (Cache Poisoning):** Initial testing returned stale UPS Sandbox data (e.g., "Shenzhen 2024") because `dev.db` persisted across sessions.
    * *Fix:* Created a `db:clear` utility script to flush the cache and updated `.env` to point to `onlinetools.ups.com` (Production).

### 4. The Outcome
* **Vertical Slice Complete:** The system successfully tracks **Live UPS Production** packages in real-time.
* **Performance Verified:** Confirmed ~530ms for real API round-trips vs ~11ms for Cache Hits directly in the new Dashboard.
* **State:** The project is fully migrated to the local agent workflow, stable, and ready for Background Jobs.
