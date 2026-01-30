import type { FastifyRequest, FastifyReply } from 'fastify';
import { uspsAuthService, UspsAuthError } from '../services/UspsAuthService.js';
import { uspsTrackingService, UspsTrackingError } from '../services/UspsTrackingService.js';

interface TrackShipmentParams {
  trackingNumber: string;
}

class UspsController {
  async getAuthStatus(request: FastifyRequest, reply: FastifyReply) {
    try {
      await uspsAuthService.getToken();
      return reply.status(200).send({ status: 'OK', provider: 'USPS', message: 'Token is valid' });
    } catch (error) {
      if (error instanceof UspsAuthError) {
        request.log.error({ code: error.code, statusCode: error.statusCode }, `USPS Auth Error: ${error.message}`);
        return reply.status(502).send({ status: 'ERROR', message: 'USPS Connection Failed', error: error.message, code: error.code });
      }
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return reply.status(502).send({ status: 'ERROR', message: 'USPS Connection Failed', error: errorMessage });
    }
  }

  async trackShipment(request: FastifyRequest<{ Params: TrackShipmentParams }>, reply: FastifyReply) {
    const { trackingNumber } = request.params;
    try {
      const data = await uspsTrackingService.trackShipment(trackingNumber);
      return reply.status(200).send({ status: 'OK', provider: 'USPS', data });
    } catch (error) {
      request.log.error(error, `Failed to track USPS shipment: ${trackingNumber}`);
      if (error instanceof UspsTrackingError) {
        const statusCode = error.statusCode >= 400 && error.statusCode < 600 ? error.statusCode : 500;
        return reply.status(statusCode).send({ status: 'ERROR', message: error.message, error: error.uspsErrorCode });
      }
      return reply.status(500).send({ status: 'ERROR', message: error instanceof Error ? error.message : 'Unknown error' });
    }
  }

  async trackShipmentRaw(request: FastifyRequest<{ Params: TrackShipmentParams }>, reply: FastifyReply) {
    const { trackingNumber } = request.params;
    try {
      const data = await uspsTrackingService.trackShipmentRaw(trackingNumber);
      return reply.status(200).send({ status: 'OK', provider: 'USPS', data });
    } catch (error) {
      request.log.error(error, `Failed to track USPS shipment (raw): ${trackingNumber}`);
      if (error instanceof UspsTrackingError) {
        return reply.status(error.statusCode).send({ status: 'ERROR', message: error.message, error: error.uspsErrorCode });
      }
      return reply.status(500).send({ status: 'ERROR', message: error instanceof Error ? error.message : 'Unknown error' });
    }
  }
}

export const uspsController = new UspsController();
export default uspsController;