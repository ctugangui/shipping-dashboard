import { prisma } from '../lib/prisma.js';
import { upsTrackingService } from './UpsTrackingService.js';
import type { UnifiedShipment, ShipmentEvent } from '../types/UnifiedShipment.js';

// Cache configuration
const CACHE_TTL_MINUTES = 15;

// Carrier detection regex patterns
const CARRIER_PATTERNS = {
  UPS: /^1Z[A-Z0-9]{16}$/i,
  FEDEX: /^[0-9]{12,22}$/,
  USPS: /^(94|93|92|94|95)[0-9]{20,22}$/,
} as const;

type SupportedCarrier = keyof typeof CARRIER_PATTERNS;

/**
 * Detect carrier from tracking number format
 */
function detectCarrier(trackingNumber: string): SupportedCarrier | null {
  const cleaned = trackingNumber.replace(/\s/g, '').toUpperCase();

  for (const [carrier, pattern] of Object.entries(CARRIER_PATTERNS)) {
    if (pattern.test(cleaned)) {
      return carrier as SupportedCarrier;
    }
  }

  // Default to UPS for now if pattern doesn't match
  return 'UPS';
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

class ShipmentService {
  /**
   * Get shipment data with Cache-Aside pattern
   */
  async getShipment(trackingNumber: string): Promise<UnifiedShipment> {
    const normalizedTrackingNumber = trackingNumber.replace(/\s/g, '').toUpperCase();

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
      console.log(`[ShipmentService] Cache HIT for ${normalizedTrackingNumber}`);
      return mapDbToUnifiedShipment(cachedShipment);
    }

    console.log(`[ShipmentService] Cache MISS for ${normalizedTrackingNumber}`);

    // Attempt 2: Fetch from API
    const carrier = detectCarrier(normalizedTrackingNumber);
    let freshData: UnifiedShipment;

    switch (carrier) {
      case 'UPS':
        freshData = await upsTrackingService.trackShipment(normalizedTrackingNumber);
        break;
      case 'FEDEX':
      case 'USPS':
        throw new Error(`Carrier ${carrier} is not yet supported`);
      default:
        throw new Error(`Unable to determine carrier for tracking number: ${normalizedTrackingNumber}`);
    }

    // Persist to database
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
    await prisma.$transaction(async (tx) => {
      const shipment = await tx.cachedShipment.upsert({
        where: { trackingNumber },
        update: {
          carrier: data.carrier,
          status: data.status,
          estimatedDelivery: data.estimatedDelivery ? new Date(data.estimatedDelivery) : null,
          currentLocation: data.currentLocation,
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
    const carrier = detectCarrier(normalizedTrackingNumber);

    let freshData: UnifiedShipment;

    switch (carrier) {
      case 'UPS':
        freshData = await upsTrackingService.trackShipment(normalizedTrackingNumber);
        break;
      default:
        throw new Error(`Carrier ${carrier} is not yet supported`);
    }

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
    }).catch(() => {});

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
      byStatus: Object.fromEntries(byStatus.map((s) => [s.status, s._count.status])),
      byCarrier: Object.fromEntries(byCarrier.map((c) => [c.carrier, c._count.carrier])),
    };
  }
}

export const shipmentService = new ShipmentService();
export default shipmentService;