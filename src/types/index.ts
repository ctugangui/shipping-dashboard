import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

// Re-export Fastify types for convenience
export type { FastifyInstance, FastifyRequest, FastifyReply };

// Purchase Order types
export interface CreatePurchaseOrderInput {
  orderNumber: string;
  status?: string;
  metadata?: Record<string, unknown>;
}

export interface UpdatePurchaseOrderInput {
  status?: string;
  metadata?: Record<string, unknown>;
}

// Shipment types
export interface CreateShipmentInput {
  trackingNumber: string;
  carrier: string;
  status?: string;
  purchaseOrderId: string;
}

export interface UpdateShipmentInput {
  status?: string;
  carrier?: string;
}

// Tracking Event types
export interface CreateTrackingEventInput {
  status: string;
  description?: string;
  timestamp: Date;
  shipmentId: string;
}

// Internal Config types (for UPS Auth, etc.)
export interface InternalConfigInput {
  key: string;
  value: string;
  expiresAt?: Date;
}

// API Response types
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Health check response
export interface HealthCheckResponse {
  status: 'ok' | 'error';
  timestamp: string;
  uptime: number;
}
