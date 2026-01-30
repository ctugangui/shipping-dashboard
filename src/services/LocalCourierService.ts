/**
 * Local Courier Service
 * A mock carrier service for testing multi-carrier architecture
 * Simulates network latency and returns deterministic responses based on tracking number
 */

import type { UnifiedShipment, ShipmentEvent } from '../types/UnifiedShipment.js';

// Simulated network latency in milliseconds
const SIMULATED_LATENCY_MS = 800;

// Custom error class for Local Courier failures
export class LocalCourierError extends Error {
  public readonly statusCode: number;
  public readonly errorCode?: string;

  constructor(message: string, statusCode: number, errorCode?: string) {
    super(message);
    this.name = 'LocalCourierError';
    this.statusCode = statusCode;
    this.errorCode = errorCode;
  }
}

/**
 * Generate mock tracking events based on status
 */
function generateMockEvents(
  trackingNumber: string,
  status: 'DELIVERED' | 'EXCEPTION' | 'TRANSIT'
): ShipmentEvent[] {
  const now = new Date();
  const events: ShipmentEvent[] = [];

  // Base event - package received
  const dayMinus3 = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
  events.push({
    timestamp: dayMinus3.toISOString(),
    location: 'Local Courier Hub, Portland, OR',
    description: 'Package received at origin facility',
    status: 'RECEIVED',
  });

  // In transit event
  const dayMinus2 = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
  events.push({
    timestamp: dayMinus2.toISOString(),
    location: 'Distribution Center, Seattle, WA',
    description: 'Package in transit to destination',
    status: 'IN_TRANSIT',
  });

  // Status-specific events
  switch (status) {
    case 'DELIVERED':
      const dayMinus1 = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000);
      events.push({
        timestamp: dayMinus1.toISOString(),
        location: 'Local Delivery Station, Beaverton, OR',
        description: 'Out for delivery',
        status: 'OUT_FOR_DELIVERY',
      });
      events.push({
        timestamp: now.toISOString(),
        location: 'Beaverton, OR 97005',
        description: 'Delivered - Left at front door',
        status: 'DELIVERED',
      });
      break;

    case 'EXCEPTION':
      events.push({
        timestamp: now.toISOString(),
        location: 'Local Delivery Station, Beaverton, OR',
        description: 'Delivery exception - Address not found',
        status: 'EXCEPTION',
      });
      break;

    case 'TRANSIT':
    default:
      const hoursAgo = new Date(now.getTime() - 6 * 60 * 60 * 1000);
      events.push({
        timestamp: hoursAgo.toISOString(),
        location: 'Local Delivery Station, Beaverton, OR',
        description: 'Arrived at local delivery station',
        status: 'ARRIVED',
      });
      break;
  }

  // Sort events by timestamp (most recent first)
  events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return events;
}

/**
 * Determine status based on tracking number suffix
 * - Ends with 'DEL': DELIVERED
 * - Ends with 'EXC': EXCEPTION
 * - Otherwise: TRANSIT
 */
function determineStatus(trackingNumber: string): 'DELIVERED' | 'EXCEPTION' | 'TRANSIT' {
  const upperTrackingNumber = trackingNumber.toUpperCase();

  if (upperTrackingNumber.endsWith('DEL')) {
    return 'DELIVERED';
  }

  if (upperTrackingNumber.endsWith('EXC')) {
    return 'EXCEPTION';
  }

  return 'TRANSIT';
}

/**
 * Get current location based on status
 */
function getCurrentLocation(status: 'DELIVERED' | 'EXCEPTION' | 'TRANSIT'): string {
  switch (status) {
    case 'DELIVERED':
      return 'Beaverton, OR 97005';
    case 'EXCEPTION':
      return 'Local Delivery Station, Beaverton, OR';
    case 'TRANSIT':
    default:
      return 'Local Delivery Station, Beaverton, OR';
  }
}

/**
 * Get estimated delivery date
 */
function getEstimatedDelivery(status: 'DELIVERED' | 'EXCEPTION' | 'TRANSIT'): string | null {
  if (status === 'DELIVERED') {
    return null; // Already delivered
  }

  // Estimate delivery in 1-2 days
  const estimatedDate = new Date();
  estimatedDate.setDate(estimatedDate.getDate() + (status === 'EXCEPTION' ? 3 : 1));
  return estimatedDate.toISOString();
}

class LocalCourierService {
  /**
   * Track a shipment by tracking number (simulated)
   * @param trackingNumber - Local Courier tracking number (should start with 'LOC')
   * @returns Normalized UnifiedShipment data
   */
  async trackShipment(trackingNumber: string): Promise<UnifiedShipment> {
    // Validate tracking number
    if (!trackingNumber || trackingNumber.trim() === '') {
      throw new LocalCourierError('Tracking number is required', 400);
    }

    // Simulate network latency
    await new Promise((resolve) => setTimeout(resolve, SIMULATED_LATENCY_MS));

    // Clean tracking number
    const cleanedTrackingNumber = trackingNumber.replace(/\s/g, '').toUpperCase();

    // Simulate random failures (5% chance) for realism
    if (Math.random() < 0.05) {
      throw new LocalCourierError(
        'Temporary service unavailable',
        503,
        'SERVICE_UNAVAILABLE'
      );
    }

    // Simulate "not found" for specific pattern
    if (cleanedTrackingNumber.includes('NOTFOUND')) {
      throw new LocalCourierError(
        `Tracking number ${cleanedTrackingNumber} not found`,
        404,
        'NOT_FOUND'
      );
    }

    // Determine status based on tracking number suffix
    const status = determineStatus(cleanedTrackingNumber);

    // Generate mock events
    const events = generateMockEvents(cleanedTrackingNumber, status);

    // Build UnifiedShipment response
    const shipment: UnifiedShipment = {
      trackingNumber: cleanedTrackingNumber,
      carrier: 'USPS', // Pretend to be USPS for testing multi-carrier
      status,
      estimatedDelivery: getEstimatedDelivery(status),
      currentLocation: getCurrentLocation(status),
      events,
    };

    console.log(
      `[LocalCourierService] Simulated tracking for ${cleanedTrackingNumber}: ${status}`
    );

    return shipment;
  }

  /**
   * Get service info (for debugging/testing)
   */
  getServiceInfo(): { name: string; simulated: boolean; latencyMs: number } {
    return {
      name: 'Local Courier Service',
      simulated: true,
      latencyMs: SIMULATED_LATENCY_MS,
    };
  }
}

// Export singleton instance
export const localCourierService = new LocalCourierService();

export default localCourierService;