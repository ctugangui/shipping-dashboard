### Phase 2: Execution

Here is the exact instruction set for your builder agent (Claude). This prompt covers the "Smoke Test," Database Schema update, and the Service Logic.

***

### CLAUDE PROMPT 002: Infrastructure & Auth Service

**Role:** Senior Backend Developer
**Context:** We have a fresh Fastify/TypeScript/Prisma scaffold.
**Task:** Verify the server, update the database schema for token storage, and implement the `UpsAuthService` using native `fetch`.

#### Step 1: Smoke Test & Configuration
1.  Ensure the server starts successfully (`npm run dev` or `npm start`).
2.  Update `.env` to include:
    ```env
    # UPS Config (Ensure these exist)
    UPS_CLIENT_ID="your_client_id"
    UPS_CLIENT_SECRET="your_client_secret"
    UPS_ACCOUNT_NUMBER="your_account_number"
    UPS_BASE_URL="https://onlinetools.ups.com" # Use CIE URL if testing
    ```

#### Step 2: Database Schema (Prisma)
Modify `prisma/schema.prisma`. Add a model to store external API tokens to prevent re-authentication loops during development.

```prisma
model SystemToken {
  id        String   @id @default(uuid())
  provider  String   @unique // e.g., "UPS", "USPS"
  token     String
  expiresAt DateTime
  updatedAt DateTime @updatedAt
}
```
*Run `npx prisma migrate dev --name init_system_tokens` after updating.*

#### Step 3: Implement `src/services/UpsAuthService.ts`
Create this file. It must handle the OAuth 2.0 Client Credentials flow.

**Requirements:**
1.  **Native Fetch:** Use Node.js built-in `fetch`. No `axios`.
2.  **Logic Flow:**
    *   `getToken()` method:
        *   Check `SystemToken` table for provider "UPS".
        *   If token exists AND `expiresAt` is > (now + 5 minutes buffer), return it.
        *   Else, call `fetchNewToken()`.
    *   `fetchNewToken()` private method:
        *   POST to `${UPS_BASE_URL}/security/v1/oauth/token`.
        *   Headers: `Authorization: Basic <Base64(ClientId:ClientSecret)>`, `Content-Type: application/x-www-form-urlencoded`.
        *   Body: `grant_type=client_credentials`.
        *   On success: Calculate `expiresAt` (now + `expires_in` seconds), upsert the record in Prisma, and return the token.
        *   On failure: Throw a structured error.
3.  **Typing:** Use strict TypeScript interfaces for the UPS response.
4.  **Singleton:** Export an instance of the class (e.g., `export const upsAuthService = new UpsAuthService();`).

**Deliverables:**
1.  Updated `prisma/schema.prisma`.
2.  `src/services/UpsAuthService.ts` code.
3.  A script or instruction to run the migration.

***

### Instructions for User:
1.  Paste **Claude Prompt 002** into your chat with Claude.
2.  Run the generated migration command.
3.  Report back when the file `src/services/UpsAuthService.ts` is created and the server is running without errors.