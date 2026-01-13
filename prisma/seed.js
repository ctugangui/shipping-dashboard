import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Seed data for development and testing
 */
const seedData = {
  purchaseOrders: [
    {
      orderNumber: 'PO-2024-001',
      status: 'PENDING',
      metadata: JSON.stringify({
        customerName: 'Acme Corporation',
        customerEmail: 'orders@acme.example.com',
        shippingAddress: {
          street: '123 Main Street',
          city: 'Portland',
          state: 'OR',
          zip: '97201',
        },
      }),
    },
  ],
  shipments: [
    {
      trackingNumber: '1Z999AA10123456784',
      carrier: 'UPS',
      status: 'LABEL_CREATED',
      labelUrl: 'https://example.com/labels/1Z999AA10123456784.pdf',
    },
  ],
  trackingEvents: [
    {
      status: 'LABEL_CREATED',
      location: 'Portland, OR',
      description: 'Shipping label created, package pending pickup',
    },
  ],
};

async function main() {
  console.log('🌱 Starting database seed...\n');

  // Clear existing data (in reverse order due to foreign keys)
  console.log('🗑️  Clearing existing data...');
  await prisma.trackingEvent.deleteMany();
  await prisma.shipment.deleteMany();
  await prisma.purchaseOrder.deleteMany();

  // Create Purchase Order
  console.log('📦 Creating Purchase Order...');
  const purchaseOrder = await prisma.purchaseOrder.create({
    data: seedData.purchaseOrders[0],
  });
  console.log(`   ✓ Created: ${purchaseOrder.orderNumber}`);

  // Create Shipment linked to Purchase Order
  console.log('🚚 Creating Shipment...');
  const shipment = await prisma.shipment.create({
    data: {
      ...seedData.shipments[0],
      purchaseOrderId: purchaseOrder.id,
    },
  });
  console.log(`   ✓ Created: ${shipment.trackingNumber} (${shipment.carrier})`);

  // Create Tracking Event linked to Shipment
  console.log('📍 Creating Tracking Event...');
  const trackingEvent = await prisma.trackingEvent.create({
    data: {
      ...seedData.trackingEvents[0],
      shipmentId: shipment.id,
    },
  });
  console.log(`   ✓ Created: ${trackingEvent.status} at ${trackingEvent.location}`);

  // Summary
  console.log('\n✅ Seed completed successfully!');
  console.log('─'.repeat(40));
  console.log(`   Purchase Orders: 1`);
  console.log(`   Shipments:       1`);
  console.log(`   Tracking Events: 1`);
  console.log('─'.repeat(40));
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error('❌ Seed failed:', error);
    await prisma.$disconnect();
    process.exit(1);
  });
