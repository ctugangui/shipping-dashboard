### Phase 1: Verification & Architecture

**Architecture Decision:**
We will **persist the UPS Access Token in SQLite via Prisma**.
*   **Why:** Storing tokens in memory causes a new API handshake every time you save a file (server restart). This triggers UPS rate limits.
*   **How:** Create a `SystemToken` model in Prisma.

# Prompt 001: Initial Scaffold (The Scorched Earth Protocol)

**Role:** Senior DevOps / Backend Architect
**Task:** Initialize a production-ready Node.js backend scaffold.
**Constraints:**
- **Runtime:** Node.js v22 LTS
- **Language:** TypeScript 5.x (Strict Mode)
- **Framework:** Fastify (v5+)
- **ORM:** Prisma (SQLite for dev)
- **Environment:** dotenv for config

## Steps:

1.  **Project Initialization:**
    - `npm init -y`
    - Install dependencies: `fastify`, `@prisma/client`, `dotenv`.
    - Install dev dependencies: `typescript`, `@types/node`, `tsx` (for running TS), `prisma`, `@types/fastify`.

2.  **TypeScript Config (`tsconfig.json`):**
    - Target: `ES2022`
    - Module: `NodeNext`
    - Strict: `true`
    - OutDir: `dist`
    - RootDir: `src`

3.  **Directory Structure:**
    Create the following folder structure:
    ```text
    src/
    ├── config/      # Environment variables
    ├── controllers/ # Request handlers
    ├── routes/      # Route definitions
    ├── services/    # Business logic
    ├── types/       # TypeScript interfaces
    ├── utils/       # Helpers
    ├── app.ts       # Fastify app instance
    └── server.ts    # Server entry point
    ```

4.  **Base Files:**
    - Create a basic `server.ts` that starts Fastify on port 3000.
    - Create a `.env` file template.
    - Initialize Prisma (`npx prisma init --datasource-provider sqlite`).

5.  **Scripts:**
    - Add `"dev": "tsx watch src/server.ts"` to `package.json`.