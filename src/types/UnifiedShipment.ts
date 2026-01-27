/**
 * Unified Shipment Types
 * Standard interface for all carrier tracking data
 */

export interface ShipmentEvent {
  timestamp: string; // ISO String
  location: string;
  description: string;
  status: string; // e.g., "DEPARTURE", "ARRIVAL", "DELIVERED"
}

export type CarrierType = 'UPS' | 'USPS' | 'FEDEX';

export type ShipmentStatus = 'TRANSIT' | 'DELIVERED' | 'EXCEPTION' | 'UNKNOWN' | 'PENDING';

export interface UnifiedShipment {
  trackingNumber: string;
  carrier: CarrierType;
  status: ShipmentStatus;
  estimatedDelivery: string | null; // ISO String
  currentLocation: string | null;
  events: ShipmentEvent[];
  raw?: unknown; // Optional: Keep raw data for debugging
}