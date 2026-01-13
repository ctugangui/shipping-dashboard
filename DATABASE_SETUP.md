# Database Setup Instructions

## Quick Start Commands

Run these commands in order to initialize your database:

```bash
# 1. Install dependencies (includes Prisma)
npm install

# 2. Generate Prisma Client
npx prisma generate

# 3. Run initial migration (creates SQLite database)
npx prisma migrate dev --name init

# 4. Seed the database with test data
npm run db:seed
```

## Available Database Scripts

| Command | Description |
|---------|-------------|
| `npm run db:generate` | Regenerate Prisma Client after schema changes |
| `npm run db:migrate` | Create and apply a new migration |
| `npm run db:push` | Push schema changes without creating a migration |
| `npm run db:seed` | Populate database with test data |
| `npm run db:studio` | Open Prisma Studio GUI (http://localhost:5555) |
| `npm run db:reset` | Reset database and re-run all migrations + seed |

## Schema Overview

```
┌─────────────────────┐
│   PurchaseOrder     │
├─────────────────────┤
│ id (UUID)           │
│ orderNumber (unique)│
│ status              │
│ metadata (JSON)     │
│ createdAt           │
│ updatedAt           │
└─────────┬───────────┘
          │ 1:N
          ▼
┌─────────────────────┐
│     Shipment        │
├─────────────────────┤
│ id (UUID)           │
│ trackingNumber (unq)│
│ carrier             │
│ status              │
│ labelUrl            │
│ createdAt           │
│ updatedAt           │
└─────────┬───────────┘
          │ 1:N
          ▼
┌─────────────────────┐
│   TrackingEvent     │
├─────────────────────┤
│ id (UUID)           │
│ status              │
│ location            │
│ description         │
│ timestamp           │
└─────────────────────┘
```

## Status Values

### PurchaseOrder.status
- `PENDING` - Order created, no shipments yet
- `PARTIAL` - Some items shipped
- `FULFILLED` - All items shipped
- `CANCELLED` - Order cancelled

### Shipment.status
- `LABEL_CREATED` - Label generated, awaiting pickup
- `TRANSIT` - Package in transit
- `DELIVERED` - Package delivered

## Using Prisma Client in Code

```javascript
import prisma from './src/lib/prisma.js';

// Create a new order with shipment
const order = await prisma.purchaseOrder.create({
  data: {
    orderNumber: 'PO-2024-002',
    status: 'PENDING',
    shipments: {
      create: {
        trackingNumber: '1Z999AA10123456785',
        carrier: 'UPS',
        status: 'LABEL_CREATED',
      },
    },
  },
  include: { shipments: true },
});

// Query with relations
const orderWithShipments = await prisma.purchaseOrder.findUnique({
  where: { orderNumber: 'PO-2024-001' },
  include: {
    shipments: {
      include: { trackingEvents: true },
    },
  },
});
```

## Troubleshooting

### "Cannot find module '@prisma/client'"
Run `npx prisma generate` to generate the client.

### Database file not found
Ensure `DATABASE_URL` in `.env` points to a valid path, then run migrations.

### Migration conflicts
Run `npm run db:reset` to start fresh (⚠️ deletes all data).
