# Prompt 016: Simple Personal Authentication

**Role:** Full Stack Security Developer
**Context:** We want to lock down our shipping dashboard so it can be hosted safely. We will use a single-password "Personal Server" approach rather than a full multi-user database.
**Goal:** Implement a password-protected login screen using cookies and an environment variable.

# Requirements

## 1. Setup & Configuration
* **Dependencies:** Install `@fastify/cookie` to handle session cookies (`npm install @fastify/cookie`).
* **Environment:** Assume an environment variable exists called `ADMIN_PASSWORD`. (For development, default to "secret123" if it's not set).
* **App Registration:** In `src/app.ts`, register the `@fastify/cookie` plugin.

## 2. Frontend: Login Page
* **File:** Create `src/views/login.ejs`.
* **Layout:** Use the same dark Tailwind slate theme as the main dashboard. Center a login card on the screen.
* **Form:** * A single password input (`name="password"`, `type="password"`).
  * A submit button ("Login").
  * Display an error message if passed in via the query string (e.g., `?error=1`).

## 3. Backend: Auth Routes & Middleware
* **New Routes:** * `GET /login`: Renders `login.ejs`.
  * `POST /login`: Checks `req.body.password` against `process.env.ADMIN_PASSWORD`.
    * *Success:* Set a secure, HttpOnly cookie (e.g., `auth_session=true`) with a 30-day expiration, then redirect to `/`.
    * *Failure:* Redirect to `/login?error=1`.
  * `POST /logout`: Clears the cookie and redirects to `/login`.
* **Protection (Pre-handler):**
  * Create an authentication middleware function (or Fastify `preHandler`).
  * Apply this to the homepage (`GET /`), the track route (`POST /track`), and the API routes (`DELETE /api/shipments/:id`).
  * **Logic:** If the `auth_session` cookie is missing or invalid, redirect the user to `/login` (or return 401 for API routes).

## 4. UI Polish: Logout Button
* **File:** `src/views/index.ejs`
* **Action:** Add a small "Logout" button or link in the top header (perhaps next to the global sync indicator) that points to the logout route.

# Verification
1. Run `npm run build` to ensure no TypeScript errors.
2. Open an incognito window and go to `http://localhost:3000`. You should be redirected to `/login`.
3. Try an incorrect password (should fail). Try the correct password (should log you in and show the Kanban board).