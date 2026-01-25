import type { FastifyRequest, FastifyReply } from 'fastify';
import { upsAuthService, UpsAuthError } from '../services/UpsAuthService.js';

// Response interfaces
interface AuthStatusResponse {
  status: 'OK' | 'ERROR';
  provider?: string;
  message: string;
  error?: string;
  code?: string;
}

class UpsController {
  /**
   * GET /api/ups/status
   * Check if UPS authentication is working
   */
  async getAuthStatus(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<AuthStatusResponse> {
    try {
      await upsAuthService.getToken();

      return reply.status(200).send({
        status: 'OK',
        provider: 'UPS',
        message: 'Token is valid',
      });
    } catch (error) {
      // Log the error details
      if (error instanceof UpsAuthError) {
        request.log.error(
          { code: error.code, statusCode: error.statusCode },
          `UPS Auth Error: ${error.message}`
        );

        return reply.status(502).send({
          status: 'ERROR',
          message: 'UPS Connection Failed',
          error: error.message,
          code: error.code,
        });
      } else {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        request.log.error(error, 'UPS Connection Error');

        return reply.status(502).send({
          status: 'ERROR',
          message: 'UPS Connection Failed',
          error: errorMessage,
        });
      }
    }
  }
}

// Export singleton instance
export const upsController = new UpsController();

export default upsController;
