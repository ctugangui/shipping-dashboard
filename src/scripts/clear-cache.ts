import { prisma } from '../lib/prisma.js';

async function clearCache() {
  try {
    console.log('🗑️  Clearing cached shipment data...');
    
    const result = await prisma.cachedShipment.deleteMany({});
    
    console.log(`✅ Deleted ${result.count} cached shipments.`);
    console.log('Cache cleared successfully!');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error clearing cache:', error);
    process.exit(1);
  }
}

clearCache();
