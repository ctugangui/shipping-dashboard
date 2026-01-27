import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

// Re-export Fastify types for convenience
export type { FastifyInstance, FastifyRequest, FastifyReply };

// Re-export unified shipment types
export type {
  UnifiedShipment,
  ShipmentEvent,
  CarrierType,
  ShipmentStatus,
} from './UnifiedShipment.js';