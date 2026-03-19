import { prisma } from '../lib/prisma.js';
import { upsTrackingService } from './UpsTrackingService.js';
import { uspsTrackingService } from './UspsTrackingService.js';
import { localCourierService } from './LocalCourierService.js';
import { fedexTrackingService } from './FedexTrackingService.js';
import { track123Service } from './Track123Service.js';
import type { UnifiedShipment, ShipmentEvent } from '../types/UnifiedShipment.js';

// Cache configuration
const CACHE_TTL_MINUTES = 15;

// Carrier types for routing
type CarrierRoute = 'UPS' | 'USPS' | 'FEDEX' | 'LOCAL' | 'ONTRAC';

// Carrier detection patterns with priority order
const CARRIER_ROUTING: Array<{ pattern: RegExp; carrier: CarrierRoute }> = [
  // LOCAL: Starts with 'LOC' (for testing)
  { pattern: /^LOC/i, carrier: 'LOCAL' },
  // ONTRAC: Starts with 1LS, C, D, or S followed by 10+ alphanumerics
  { pattern: /^(1LS|C|D|S)[A-Z0-9]{10,}$/i, carrier: 'ONTRAC' },
  // UPS: Starts with '1Z' followed by 16 alphanumeric characters
  { pattern: /^1Z[A-Z0-9]{16}$/i, carrier: 'UPS' },
  // USPS: Starts with 94, 93, 92, or 95 followed by 20-22 digits
  { pattern: /^(94|93|92|95)\d{20,22}$/, carrier: 'USPS' },
  // FEDEX: 12-20 digit numbers (check after USPS to avoid conflicts)
  { pattern: /^[0-9]{12,20}$/, carrier: 'FEDEX' },
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
      console.log(`[ShipmentService] Routing to FEDEX for ${trackingNumber}`);
      return fedexTrackingService.trackShipment(trackingNumber);

    case 'ONTRAC':
      console.log(`[ShipmentService] Routing to TRACK123 (OnTrac) for ${trackingNumber}`);
      return track123Service.getShipment(trackingNumber);

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
        `Supported formats: UPS (1Z...), USPS (94/93/92/95...), FedEx (12-20 digits), OnTrac (1LS.../C.../D.../S...), LOCAL (LOC...)`
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
    await prisma.$transaction(async (tx) => {
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
   * Get all non-delivered (active) shipments from the database
   */
  async getActiveShipments(): Promise<Array<{ id: string; trackingNumber: string; status: string }>> {
    return prisma.cachedShipment.findMany({
      where: {
        status: {
          not: 'DELIVERED',
        },
      },
      select: {
        id: true,
        trackingNumber: true,
        status: true,
      },
    });
  }

  /**
   * Fetch live data for a tracking number and update the database record
   */
  async updateShipment(trackingNumber: string): Promise<void> {
    const normalizedTrackingNumber = trackingNumber.replace(/\s/g, '').toUpperCase();

    const carrier = detectCarrier(normalizedTrackingNumber);
    if (!carrier) {
      throw new Error(
        `Unable to determine carrier for tracking number: ${normalizedTrackingNumber}`
      );
    }

    console.log(`[ShipmentService] Refreshing ${normalizedTrackingNumber} (${carrier})`);
    const freshData = await fetchFromCarrier(normalizedTrackingNumber, carrier);
    await this.upsertShipmentCache(normalizedTrackingNumber, freshData);
  }

  /**
   * Check if a shipment already exists in the database cache
   */
  async shipmentExists(trackingNumber: string): Promise<boolean> {
    const normalizedTrackingNumber = trackingNumber.replace(/\s/g, '').toUpperCase();
    const count = await prisma.cachedShipment.count({
      where: { trackingNumber: normalizedTrackingNumber },
    });
    return count > 0;
  }

  /**
   * Detect carrier for a tracking number (exposed for debugging)
   */
  detectCarrier(trackingNumber: string): CarrierRoute | null {
    return detectCarrier(trackingNumber.replace(/\s/g, '').toUpperCase());
  }

  /**
   * Sync tracking numbers from Google Sheets.
   * Fetches all numbers, skips existing ones, and saves new ones.
   * Returns the count of newly added shipments.
   */
  async runSheetSync(): Promise<number> {
    try {
      const { googleSheetsService } = await import('./GoogleSheetsService.js');
      const trackingNumbers = await googleSheetsService.getTrackingNumbers();

      let newCount = 0;
      for (const number of trackingNumbers) {
        const exists = await this.shipmentExists(number);
        if (!exists) {
          try {
            await this.getShipment(number);
            newCount++;
          } catch (err) {
            console.error(`[ShipmentService] runSheetSync: failed to fetch ${number}:`, err);
          }
        }
      }

      console.log(`[ShipmentService] runSheetSync complete: ${newCount} new shipment(s) added.`);
      return newCount;
    } catch (err) {
      console.error('[ShipmentService] runSheetSync error:', err);
      return 0;
    }
  }

  /**
   * Get shipments for the main dashboard with optional search query.
   * - If searchQuery is provided: return ALL shipments where trackingNumber contains the query (case-insensitive).
   * - If no searchQuery: return PROCESSING and IN_TRANSIT shipments, plus DELIVERED shipments updated within the last 7 days.
   */
  async getRecentShipments(searchQuery?: string): Promise<Array<{
    id: string;
    trackingNumber: string;
    carrier: string;
    status: string;
    estimatedDelivery: Date | null;
    currentLocation: string | null;
    updatedAt: Date;
  }>> {
    if (searchQuery && searchQuery.trim()) {
      // Search mode: return all shipments matching the tracking number query
      return prisma.cachedShipment.findMany({
        where: {
          trackingNumber: {
            contains: searchQuery.trim().toUpperCase(),
          },
        },
        orderBy: { updatedAt: 'desc' },
      });
    }

    // Default mode: active shipments + recently delivered (within 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    return prisma.cachedShipment.findMany({
      where: {
        OR: [
          // All non-delivered statuses
          {
            status: {
              notIn: ['DELIVERED'],
            },
          },
          // Delivered but within the last 7 days (use estimatedDelivery, fall back to updatedAt if null)
          {
            status: 'DELIVERED',
            OR: [
              { estimatedDelivery: { gte: sevenDaysAgo } },
              { estimatedDelivery: null, updatedAt: { gte: sevenDaysAgo } },
            ],
          },
        ],
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  /**
   * Get archived shipments: DELIVERED shipments older than 7 days, ordered by updatedAt descending.
   */
  async getArchivedShipments(): Promise<Array<{
    id: string;
    trackingNumber: string;
    carrier: string;
    status: string;
    estimatedDelivery: Date | null;
    currentLocation: string | null;
    updatedAt: Date;
  }>> {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    return prisma.cachedShipment.findMany({
      where: {
        status: 'DELIVERED',
        OR: [
          { estimatedDelivery: { lt: sevenDaysAgo } },
          { estimatedDelivery: null, updatedAt: { lt: sevenDaysAgo } },
        ],
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  /**
   * Refresh all active (non-delivered) shipments by re-querying their carrier APIs.
   * Waits 500ms between each update to avoid rate limiting.
   * Returns the count of successfully updated shipments.
   */
  async runActiveRefresh(): Promise<number> {
    try {
      const activeShipments = await this.getActiveShipments();

      let updatedCount = 0;
      for (const shipment of activeShipments) {
        try {
          await this.updateShipment(shipment.trackingNumber);
          updatedCount++;
        } catch (err) {
          console.error(`[ShipmentService] runActiveRefresh: failed to update ${shipment.trackingNumber}:`, err);
        }
        await new Promise(r => setTimeout(r, 500));
      }

      console.log(`[ShipmentService] runActiveRefresh complete: ${updatedCount} shipment(s) updated.`);
      return updatedCount;
    } catch (err) {
      console.error('[ShipmentService] runActiveRefresh error:', err);
      return 0;
    }
  }
}

// Export singleton instance
export const shipmentService = new ShipmentService();

export default shipmentService;