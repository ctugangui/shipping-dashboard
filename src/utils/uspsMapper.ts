import type { UnifiedShipment, ShipmentEvent, ShipmentStatus } from '../types/UnifiedShipment.js';

interface UspsTrackingEvent {
  eventType?: string;
  eventTimestamp?: string;
  eventCountry?: string;
  eventCity?: string;
  eventState?: string;
  eventZIPCode?: string;
  eventCode?: string;
  additionalInfo?: string;
}

interface UspsTrackingInfo {
  trackingNumber?: string;
  statusCategory?: string;
  status?: string;
  destinationCity?: string;
  destinationState?: string;
  destinationZIP?: string;
  expectedDeliveryTimestamp?: string;
  guaranteedDeliveryTimestamp?: string;
  trackingEvents?: UspsTrackingEvent[];
}

interface UspsTrackingResponse {
  trackingNumber?: string;
  trackingInfo?: UspsTrackingInfo;
  error?: { code?: string; message?: string };
}

function mapUspsStatusToUnified(statusCategory?: string, status?: string): ShipmentStatus {
  const category = statusCategory?.toUpperCase() || '';
  const statusUpper = status?.toUpperCase() || '';

  if (category === 'DELIVERED' || statusUpper.includes('DELIVERED')) return 'DELIVERED';
  if (category.includes('TRANSIT') || statusUpper.includes('TRANSIT') || statusUpper.includes('OUT FOR DELIVERY')) return 'TRANSIT';
  if (category === 'ALERT' || statusUpper.includes('EXCEPTION') || statusUpper.includes('UNDELIVERABLE')) return 'EXCEPTION';
  if (category.includes('PRE-SHIPMENT') || statusUpper.includes('LABEL CREATED')) return 'PENDING';
  return 'UNKNOWN';
}

function formatUspsTimestamp(timestamp?: string): string {
  if (!timestamp) return new Date().toISOString();
  try {
    const parsed = new Date(timestamp);
    return isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
  } catch {
    return new Date().toISOString();
  }
}

function formatUspsLocation(event: UspsTrackingEvent): string {
  const parts: string[] = [];
  if (event.eventCity) parts.push(event.eventCity);
  if (event.eventState) parts.push(event.eventState);
  if (event.eventZIPCode) parts.push(event.eventZIPCode);
  if (event.eventCountry && !['US', 'USA'].includes(event.eventCountry)) parts.push(event.eventCountry);
  return parts.length > 0 ? parts.join(', ') : 'Unknown Location';
}

export function normalizeUspsResponse(rawResponse: UspsTrackingResponse, includeRaw = false): UnifiedShipment {
  const trackingInfo = rawResponse.trackingInfo;

  if (!trackingInfo) {
    return {
      trackingNumber: rawResponse.trackingNumber || 'UNKNOWN',
      carrier: 'USPS',
      status: 'UNKNOWN',
      estimatedDelivery: null,
      currentLocation: null,
      events: [],
      ...(includeRaw && { raw: rawResponse }),
    };
  }

  const trackingEvents = trackingInfo.trackingEvents || [];
  const events: ShipmentEvent[] = trackingEvents.map((event) => ({
    timestamp: formatUspsTimestamp(event.eventTimestamp),
    location: formatUspsLocation(event),
    description: event.eventType || event.additionalInfo || 'Status update',
    status: event.eventCode || event.eventType || 'UNKNOWN',
  }));

  events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return {
    trackingNumber: trackingInfo.trackingNumber || rawResponse.trackingNumber || 'UNKNOWN',
    carrier: 'USPS',
    status: mapUspsStatusToUnified(trackingInfo.statusCategory, trackingInfo.status),
    estimatedDelivery: trackingInfo.expectedDeliveryTimestamp ? formatUspsTimestamp(trackingInfo.expectedDeliveryTimestamp) : null,
    currentLocation: events[0]?.location || null,
    events,
    ...(includeRaw && { raw: rawResponse }),
  };
}

export default normalizeUspsResponse;