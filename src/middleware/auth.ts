import type { FastifyReply } from 'fastify';

// @fastify/cookie augments FastifyRequest with a `cookies` property at runtime.
// We use a minimal local interface to avoid a full module augmentation import.
interface RequestWithCookies {
  cookies: Record<string, string | undefined>;
}

/**
 * Checks whether the incoming request has a valid auth_session cookie.
 * Used as a preHandler on protected routes.
 *
 * - For browser routes (GET /, POST /track): redirects to /login on failure.
 * - For API routes (DELETE /api/shipments/:id): returns 401 JSON on failure.
 */
export function requireAuth(isApiRoute = false) {
  return async function authPreHandler(
    request: RequestWithCookies,
    reply: FastifyReply,
  ): Promise<void> {
    const cookie = request.cookies['auth_session'];

    if (cookie !== 'true') {
      if (isApiRoute) {
        reply.code(401).send({ error: 'Unauthorized' });
      } else {
        reply.redirect('/login');
      }
    }
  };
}
