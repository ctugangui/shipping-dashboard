# Prompt 012: Containerization (Docker)

**Role:** DevOps Engineer
**Context:** We have a Fastify/Node.js app with a SQLite database and an EJS frontend.
**Goal:** Create a production-ready `Dockerfile` and `docker-compose.yml` setup.

# Requirements

## 1. The Dockerfile
Create a `Dockerfile` in the project root.
* **Base Image:** Use `node:20-alpine` (lightweight).
* **Build Steps:**
    * Copy `package.json` and `package-lock.json`.
    * Install dependencies (`npm ci` for clean install).
    * Copy the rest of the source code.
    * Generate Prisma Client (`npx prisma generate`).
    * Build the TypeScript (`npm run build`).
* **Runtime:**
    * Expose port `3000`.
    * Command: `npm run start` (ensure this script exists in package.json and runs `node dist/server.js`).

## 2. Docker Compose (`docker-compose.yml`)
Create a `docker-compose.yml` to orchestrate the app and persistent storage.
* **Service:** `shipping-dashboard`
* **Build:** Current context (`.`).
* **Ports:** Map host `3000` to container `3000`.
* **Volumes:**
    * Mount a local volume for the SQLite database so data persists across restarts: `./prisma:/app/prisma`
* **Environment Variables:**
    * Set `DATABASE_URL="file:./prisma/dev.db"`
    * Set `NODE_ENV=production`

## 3. Scripts Update
* Ensure `package.json` has a `start` script: `"start": "node dist/src/server.js"` (adjust path based on your `tsconfig.json` outDir).

# Deliverables
1.  `Dockerfile`
2.  `docker-compose.yml`
3.  Updated `package.json` (scripts).

# Verification Instructions
1.  Stop the local node server.
2.  Run `docker-compose up --build`.
3.  Visit `http://localhost:3000` to confirm the app loads.
4.  Data check: The shipments should still be there (because of the volume mount).