### Phase 3: The Integration Circuit

We will build the **UPS Controller** and **Routes**.
*   **Goal:** Create a specific endpoint (`GET /api/ups/status`) that forces the `UpsAuthService` to run its logic (check DB -> fetch UPS -> save DB).
*   **Success Metric:** Hitting this endpoint returns a `200 OK` with "Authentication Successful", proving the entire chain works.

***

### CLAUDE PROMPT 003: Controller & Route Implementation

**Role:** Senior Backend Developer
**Context:** `UpsAuthService` is implemented. We now need to expose it via the API layer.
**Task:** Create the Controller and Route files, and register them in the main application.

#### Step 1: Create `src/controllers/UpsController.ts`
Create a controller class to handle HTTP logic.
*   **Method:** `getAuthStatus`
*   **Logic:**
    1.  Call `upsAuthService.getToken()`.
    2.  If successful, return HTTP 200: `{ status: 'OK', provider: 'UPS', message: 'Token is valid' }`.
    3.  If it fails, catch the error, log it using `req.log.error()`, and return HTTP 502 (Bad Gateway): `{ status: 'ERROR', message: 'UPS Connection Failed' }`.

#### Step 2: Create `src/routes/upsRoutes.ts`
Create a Fastify route plugin.
*   **Path:** `/status` (This will become `/api/ups/status` when registered).
*   **Handler:** Bind to `UpsController.getAuthStatus`.

#### Step 3: Register in Application
Update `src/app.ts` (or `src/server.ts` — wherever you instantiate `fastify()`).
*   Import `upsRoutes`.
*   Register it with a prefix:
    ```typescript
    app.register(upsRoutes, { prefix: '/api/ups' });
    ```

**Deliverables:**
1.  Code for `src/controllers/UpsController.ts`.
2.  Code for `src/routes/upsRoutes.ts`.
3.  The specific lines to add to the server entry file.

***

### Instructions for User:
1.  Paste **Claude Prompt 003** into the chat.
2.  Apply the changes.
3.  **The Acid Test:**
    *   Ensure your `.env` has the correct UPS keys.
    *   Restart the server.
    *   Run this curl command (or open in browser):
        `curl http://localhost:3000/api/ups/status`
4.  Report the JSON response you receive.