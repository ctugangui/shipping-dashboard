import { prisma } from '../lib/prisma.js';
import { upsTrackingService } from './UpsTrackingService.js';
import { uspsTrackingService } from './UspsTrackingService.js';
import { localCourierService } from './LocalCourierService.js';
import type { UnifiedShipment, ShipmentEvent } from '../types/UnifiedShipment.js';

// Cache configuration
const CACHE_TTL_MINUTES = 15;

// Carrier types for routing
type CarrierRoute = 'UPS' | 'USPS' | 'FEDEX' | 'LOCAL';

// Carrier detection patterns with priority order
const CARRIER_ROUTING: Array<{ pattern: RegExp; carrier: CarrierRoute }> = [
  // LOCAL: Starts with 'LOC' (for testing)
  { pattern: /^LOC/i, carrier: 'LOCAL' },
  // UPS: Starts with '1Z' followed by 16 alphanumeric characters
  { pattern: /^1Z[A-Z0-9]{16}$/i, carrier: 'UPS' },
  // USPS: Starts with 94, 93, 92, or 95 followed by 20-22 digits
  { pattern: /^(94|93|92|95)\d{20,22}$/, carrier: 'USPS' },
  // FEDEX: 12-22 digit numbers (check after USPS to avoid conflicts)
  { pattern: /^\d{12,22}$/, carrier: 'FEDEX' },
];

/**
 * Detect carrier from tracking number format
 * Uses pattern matching with priority order
 */
function detectCarrier(trackingNumber: string): CarrierRoute | null {
  const cleaned = trackingNumber.replace(/\s/g, '').toUpperCase();

  for (const { pattern, carrier } of CARRIER_ROUTING) {
    if (pattern.test(cleaned)) {
      return carrier;
    }
  }

  return null;
}

/**
 * Check if cached data is still valid
 */
function isCacheValid(updatedAt: Date, status: string): boolean {
  // Delivered shipments never need refresh
  if (status === 'DELIVERED') {
    return true;
  }

  // Check if within TTL
  const now = new Date();
  const cacheAge = now.getTime() - updatedAt.getTime();
  const ttlMs = CACHE_TTL_MINUTES * 60 * 1000;

  return cacheAge < ttlMs;
}

/**
 * Map database record to UnifiedShipment interface
 */
function mapDbToUnifiedShipment(
  dbShipment: {
    id: string;
    trackingNumber: string;
    carrier: string;
    status: string;
    estimatedDelivery: Date | null;
    currentLocation: string | null;
    updatedAt: Date;
    events: Array<{
      id: string;
      timestamp: Date;
      location: string | null;
      description: string;
      status: string;
    }>;
  }
): UnifiedShipment {
  return {
    trackingNumber: dbShipment.trackingNumber,
    carrier: dbShipment.carrier as UnifiedShipment['carrier'],
    status: dbShipment.status as UnifiedShipment['status'],
    estimatedDelivery: dbShipment.estimatedDelivery?.toISOString() || null,
    currentLocation: dbShipment.currentLocation,
    events: dbShipment.events.map((event) => ({
      timestamp: event.timestamp.toISOString(),
      location: event.location || 'Unknown Location',
      description: event.description,
      status: event.status,
    })),
  };
}

/**
 * Fetch tracking data from the appropriate carrier service
 */
async function fetchFromCarrier(
  trackingNumber: string,
  carrier: CarrierRoute
): Promise<UnifiedShipment> {
  switch (carrier) {
    case 'UPS':
      console.log(`[ShipmentService] Routing to UPS for ${trackingNumber}`);
      return upsTrackingService.trackShipment(trackingNumber);

    case 'USPS':
      console.log(`[ShipmentService] Routing to USPS for ${trackingNumber}`);
      return uspsTrackingService.trackShipment(trackingNumber);

    case 'LOCAL':
      console.log(`[ShipmentService] Routing to LOCAL COURIER for ${trackingNumber}`);
      return localCourierService.trackShipment(trackingNumber);

    case 'FEDEX':
      // TODO: Implement FedEx when ready
      throw new Error('FedEx carrier is not yet implemented');

    default:
      throw new Error(`Unknown carrier: ${carrier}`);
  }
}

class ShipmentService {
  /**
   * Get shipment data with Cache-Aside pattern
   * 1. Check cache (database)
   * 2. If valid cache exists, return it
   * 3. If not, fetch from appropriate carrier API and update cache
   */
  async getShipment(trackingNumber: string): Promise<UnifiedShipment> {
    // Normalize tracking number
    const normalizedTrackingNumber = trackingNumber.replace(/\s/g, '').toUpperCase();

    // Detect carrier first for better error messages
    const carrier = detectCarrier(normalizedTrackingNumber);
    if (!carrier) {
      throw new Error(
        `Unable to determine carrier for tracking number: ${normalizedTrackingNumber}. ` +
        `Supported formats: UPS (1Z...), USPS (94/93/92/95...), LOCAL (LOC...)`
      );
    }

    // Attempt 1: Check database cache
    const cachedShipment = await prisma.cachedShipment.findUnique({
      where: { trackingNumber: normalizedTrackingNumber },
      include: {
        events: {
          orderBy: { timestamp: 'desc' },
        },
      },
    });

    // Validate cache
    if (cachedShipment && isCacheValid(cachedShipment.updatedAt, cachedShipment.status)) {
      console.log(`[ShipmentService] Cache HIT for ${normalizedTrackingNumber} (${carrier})`);
      return mapDbToUnifiedShipment(cachedShipment);
    }

    console.log(`[ShipmentService] Cache MISS for ${normalizedTrackingNumber} (${carrier})`);

    // Attempt 2: Fetch from carrier API
    const freshData = await fetchFromCarrier(normalizedTrackingNumber, carrier);

    // Persist to database using transaction
    await this.upsertShipmentCache(normalizedTrackingNumber, freshData);

    return freshData;
  }

  /**
   * Upsert shipment and events in a transaction
   */
  private async upsertShipmentCache(
    trackingNumber: string,
    data: UnifiedShipment
  ): Promise<void> {
    await prisma.$transaction(async (tx: typeof prisma) => {
      // Upsert the shipment
      const shipment = await tx.cachedShipment.upsert({
        where: { trackingNumber },
        update: {
          carrier: data.carrier,
          status: data.status,
          estimatedDelivery: data.estimatedDelivery ? new Date(data.estimatedDelivery) : null,
          currentLocation: data.currentLocation,
          // updatedAt is automatically updated by Prisma
        },
        create: {
          trackingNumber,
          carrier: data.carrier,
          status: data.status,
          estimatedDelivery: data.estimatedDelivery ? new Date(data.estimatedDelivery) : null,
          currentLocation: data.currentLocation,
        },
      });

      // Delete existing events (overwrite strategy)
      await tx.cachedShipmentEvent.deleteMany({
        where: { shipmentId: shipment.id },
      });

      // Create new events
      if (data.events.length > 0) {
        await tx.cachedShipmentEvent.createMany({
          data: data.events.map((event) => ({
            shipmentId: shipment.id,
            timestamp: new Date(event.timestamp),
            location: event.location,
            description: event.description,
            status: event.status,
          })),
        });
      }
    });

    console.log(`[ShipmentService] Cache UPDATED for ${trackingNumber}`);
  }

  /**
   * Force refresh shipment data from API (bypass cache)
   */
  async refreshShipment(trackingNumber: string): Promise<UnifiedShipment> {
    const normalizedTrackingNumber = trackingNumber.replace(/\s/g, '').toUpperCase();

    // Detect carrier
    const carrier = detectCarrier(normalizedTrackingNumber);
    if (!carrier) {
      throw new Error(
        `Unable to determine carrier for tracking number: ${normalizedTrackingNumber}`
      );
    }

    // Fetch from carrier
    const freshData = await fetchFromCarrier(normalizedTrackingNumber, carrier);

    // Update cache
    await this.upsertShipmentCache(normalizedTrackingNumber, freshData);

    return freshData;
  }

  /**
   * Invalidate cache for a tracking number
   */
  async invalidateCache(trackingNumber: string): Promise<void> {
    const normalizedTrackingNumber = trackingNumber.replace(/\s/g, '').toUpperCase();

    await prisma.cachedShipment.delete({
      where: { trackingNumber: normalizedTrackingNumber },
    }).catch(() => {
      // Ignore if not found
    });

    console.log(`[ShipmentService] Cache INVALIDATED for ${normalizedTrackingNumber}`);
  }

  /**
   * Get cache statistics
   */
  async getCacheStats(): Promise<{
    totalCached: number;
    byStatus: Record<string, number>;
    byCarrier: Record<string, number>;
  }> {
    const [totalCached, byStatus, byCarrier] = await Promise.all([
      prisma.cachedShipment.count(),
      prisma.cachedShipment.groupBy({
        by: ['status'],
        _count: { status: true },
      }),
      prisma.cachedShipment.groupBy({
        by: ['carrier'],
        _count: { carrier: true },
      }),
    ]);

    return {
      totalCached,
      byStatus: Object.fromEntries(
        byStatus.map((s: { status: string; _count: { status: number } }) => [s.status, s._count.status])
      ),
      byCarrier: Object.fromEntries(
        byCarrier.map((c: { carrier: string; _count: { carrier: number } }) => [c.carrier, c._count.carrier])
      ),
    };
  }

  /**
   * Detect carrier for a tracking number (exposed for debugging)
   */
  detectCarrier(trackingNumber: string): CarrierRoute | null {
    return detectCarrier(trackingNumber.replace(/\s/g, '').toUpperCase());
  }
}

// Export singleton instance
export const shipmentService = new ShipmentService();

export default shipmentService;