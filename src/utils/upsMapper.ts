/**
 * UPS Response Mapper
 * Transforms raw UPS tracking API response into UnifiedShipment format
 */

import type {
  UnifiedShipment,
  ShipmentEvent,
  ShipmentStatus,
} from '../types/UnifiedShipment.js';

// UPS Raw Response Types (matching actual API structure)
interface UpsAddress {
  city?: string;
  stateProvince?: string;
  countryCode?: string;
  country?: string;
  postalCode?: string;
}

interface UpsLocation {
  address?: UpsAddress;
}

interface UpsStatus {
  type?: string;
  description?: string;
  code?: string;
  statusCode?: string;
}

interface UpsActivity {
  location?: UpsLocation;
  status?: UpsStatus;
  date?: string;
  time?: string;
}

interface UpsDeliveryDate {
  type?: string;
  date?: string;
}

interface UpsPackage {
  trackingNumber?: string;
  deliveryDate?: UpsDeliveryDate[];
  deliveryTime?: {
    startTime?: string;
    endTime?: string;
    type?: string;
  };
  activity?: UpsActivity[];
  currentStatus?: UpsStatus;
}

interface UpsShipment {
  inquiryNumber?: string;
  package?: UpsPackage[];
}

interface UpsTrackResponse {
  trackResponse?: {
    shipment?: UpsShipment[];
  };
}

/**
 * Map UPS status type code to unified ShipmentStatus
 */
function mapUpsStatusToUnified(statusType?: string, statusCode?: string): ShipmentStatus {
  const type = statusType?.toUpperCase() || '';
  const code = statusCode?.toUpperCase() || '';

  // Check for delivered statuses
  if (type === 'D' || code === 'D' || code.startsWith('D')) {
    return 'DELIVERED';
  }

  // Check for exception statuses
  if (type === 'X' || code === 'X' || type === 'RS') {
    return 'EXCEPTION';
  }

  // Check for in-transit statuses
  if (type === 'I' || type === 'O' || code === 'I' || code === 'O') {
    return 'TRANSIT';
  }

  // Check for pending/manifest statuses
  if (type === 'M' || type === 'P' || code === 'M' || code === 'P') {
    return 'PENDING';
  }

  return 'UNKNOWN';
}

/**
 * Format UPS date and time into ISO string
 * UPS date format: YYYYMMDD
 * UPS time format: HHMMSS
 */
function formatUpsDateTime(date?: string, time?: string): string {
  if (!date) {
    return new Date().toISOString();
  }

  const year = date.substring(0, 4);
  const month = date.substring(4, 6);
  const day = date.substring(6, 8);

  let isoString = `${year}-${month}-${day}`;

  if (time && time.length >= 4) {
    const hours = time.substring(0, 2);
    const minutes = time.substring(2, 4);
    const seconds = time.length >= 6 ? time.substring(4, 6) : '00';
    isoString += `T${hours}:${minutes}:${seconds}`;
  } else {
    isoString += 'T00:00:00';
  }

  try {
    const parsed = new Date(isoString);
    if (isNaN(parsed.getTime())) {
      return new Date().toISOString();
    }
    return parsed.toISOString();
  } catch {
    return new Date().toISOString();
  }
}

/**
 * Format UPS address into a readable location string
 */
function formatLocation(address?: UpsAddress): string {
  if (!address) {
    return 'Unknown Location';
  }

  const parts: string[] = [];

  if (address.city) {
    parts.push(address.city);
  }

  if (address.stateProvince) {
    parts.push(address.stateProvince);
  }

  if (address.countryCode && address.countryCode !== 'US') {
    parts.push(address.countryCode);
  } else if (address.country && address.country !== 'US') {
    parts.push(address.country);
  }

  if (address.postalCode) {
    parts.push(address.postalCode);
  }

  return parts.length > 0 ? parts.join(', ') : 'Unknown Location';
}

/**
 * Map UPS activity to ShipmentEvent
 */
function mapActivityToEvent(activity: UpsActivity): ShipmentEvent {
  return {
    timestamp: formatUpsDateTime(activity.date, activity.time),
    location: formatLocation(activity.location?.address),
    description: activity.status?.description || 'Status update',
    status: activity.status?.type || activity.status?.statusCode || 'UNKNOWN',
  };
}

/**
 * Extract estimated delivery date from UPS response
 */
function getEstimatedDelivery(pkg: UpsPackage): string | null {
  if (pkg.deliveryDate && pkg.deliveryDate.length > 0) {
    const scheduledDate = pkg.deliveryDate.find(
      (d) => d.type === 'SDD' || d.type === 'DEL' || d.date
    );

    if (scheduledDate?.date) {
      return formatUpsDateTime(scheduledDate.date);
    }
  }

  return null;
}

/**
 * Get current location from most recent activity
 */
function getCurrentLocation(activities: UpsActivity[]): string | null {
  if (!activities || activities.length === 0) {
    return null;
  }

  const mostRecent = activities[0];
  return formatLocation(mostRecent.location?.address) || null;
}

/**
 * Main mapper function
 * Transforms raw UPS API response into UnifiedShipment format
 */
export function normalizeUpsResponse(
  rawResponse: UpsTrackResponse,
  includeRaw = false
): UnifiedShipment {
  const shipment = rawResponse.trackResponse?.shipment?.[0];
  const pkg = shipment?.package?.[0];

  if (!pkg) {
    return {
      trackingNumber: shipment?.inquiryNumber || 'UNKNOWN',
      carrier: 'UPS',
      status: 'UNKNOWN',
      estimatedDelivery: null,
      currentLocation: null,
      events: [],
      ...(includeRaw && { raw: rawResponse }),
    };
  }

  const activities = pkg.activity || [];
  const events: ShipmentEvent[] = activities.map(mapActivityToEvent);

  events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  const currentStatusType = pkg.currentStatus?.type || pkg.currentStatus?.statusCode;
  const mostRecentActivityType = activities[0]?.status?.type || activities[0]?.status?.statusCode;
  const status = mapUpsStatusToUnified(
    currentStatusType || mostRecentActivityType,
    pkg.currentStatus?.code
  );

  return {
    trackingNumber: pkg.trackingNumber || shipment?.inquiryNumber || 'UNKNOWN',
    carrier: 'UPS',
    status,
    estimatedDelivery: getEstimatedDelivery(pkg),
    currentLocation: getCurrentLocation(activities),
    events,
    ...(includeRaw && { raw: rawResponse }),
  };
}

export default normalizeUpsResponse;