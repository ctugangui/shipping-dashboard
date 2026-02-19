import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? 'secret123';

// 30 days in seconds
const SESSION_MAX_AGE = 60 * 60 * 24 * 30;

interface LoginBody {
  password?: string;
}

export default async function authRoutes(app: FastifyInstance) {
  // GET /login — render the login page
  app.get('/login', async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as Record<string, string | undefined>;
    return reply.view('login.ejs', { error: query['error'] === '1' });
  });

  // POST /login — validate password and set session cookie
  app.post('/login', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as LoginBody;

    if (body?.password === ADMIN_PASSWORD) {
      // Set a secure, HttpOnly cookie valid for 30 days
      reply.setCookie('auth_session', 'true', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: SESSION_MAX_AGE,
      });
      return reply.redirect('/');
    }

    return reply.redirect('/login?error=1');
  });

  // POST /logout — clear the session cookie and redirect to login
  app.post('/logout', async (_request: FastifyRequest, reply: FastifyReply) => {
    reply.clearCookie('auth_session', { path: '/' });
    return reply.redirect('/login');
  });
}
