import { prisma } from '../lib/prisma.js';
import { config } from '../config/index.js';

// UPS OAuth Response Interface
interface UpsOAuthResponse {
  token_type: string;
  issued_at: string;
  client_id: string;
  access_token: string;
  expires_in: string; // UPS returns this as a string
  status: string;
}

// UPS Error Response Interface
interface UpsErrorResponse {
  response?: {
    errors?: Array<{
      code: string;
      message: string;
    }>;
  };
}

// Custom error class for UPS Auth failures
export class UpsAuthError extends Error {
  public readonly code: string;
  public readonly statusCode: number;

  constructor(message: string, code: string, statusCode: number) {
    super(message);
    this.name = 'UpsAuthError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

const PROVIDER_NAME = 'UPS';
const TOKEN_BUFFER_MINUTES = 5;

class UpsAuthService {
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly baseUrl: string;

  constructor() {
    this.clientId = config.ups.clientId;
    this.clientSecret = config.ups.clientSecret;
    this.baseUrl = config.ups.baseUrl;

    if (!this.clientId || !this.clientSecret) {
      console.warn(
        'UPS credentials not configured. Set UPS_CLIENT_ID and UPS_CLIENT_SECRET in .env'
      );
    }
  }

  /**
   * Get a valid UPS OAuth token.
   * Returns cached token if still valid, otherwise fetches a new one.
   */
  async getToken(): Promise<string> {
    const existingToken = await this.getCachedToken();

    if (existingToken) {
      return existingToken;
    }

    return this.fetchNewToken();
  }

  /**
   * Check database for a valid cached token.
   * Returns token if valid (with 5-minute buffer), null otherwise.
   */
  private async getCachedToken(): Promise<string | null> {
    const tokenRecord = await prisma.systemToken.findUnique({
      where: { provider: PROVIDER_NAME },
    });

    if (!tokenRecord) {
      return null;
    }

    const bufferMs = TOKEN_BUFFER_MINUTES * 60 * 1000;
    const expiresAtWithBuffer = new Date(tokenRecord.expiresAt.getTime() - bufferMs);

    if (new Date() < expiresAtWithBuffer) {
      return tokenRecord.token;
    }

    return null;
  }

  /**
   * Fetch a new OAuth token from UPS API.
   * Stores the token in the database and returns it.
   */
  private async fetchNewToken(): Promise<string> {
    if (!this.clientId || !this.clientSecret) {
      throw new UpsAuthError(
        'UPS credentials not configured',
        'MISSING_CREDENTIALS',
        500
      );
    }

    const url = `${this.baseUrl}/security/v1/oauth/token`;

    const credentials = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString(
      'base64'
    );

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${credentials}`,
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
        },
        body: 'grant_type=client_credentials',
      });

      if (!response.ok) {
        const errorBody = (await response.json().catch(() => ({}))) as UpsErrorResponse;
        const errorMessage =
          errorBody.response?.errors?.[0]?.message ||
          `UPS OAuth failed with status ${response.status}`;
        const errorCode = errorBody.response?.errors?.[0]?.code || 'AUTH_FAILED';

        throw new UpsAuthError(errorMessage, errorCode, response.status);
      }

      const data = (await response.json()) as UpsOAuthResponse;

      const expiresInSeconds = parseInt(data.expires_in, 10);
      const expiresAt = new Date(Date.now() + expiresInSeconds * 1000);

      await prisma.systemToken.upsert({
        where: { provider: PROVIDER_NAME },
        update: {
          token: data.access_token,
          expiresAt,
        },
        create: {
          provider: PROVIDER_NAME,
          token: data.access_token,
          expiresAt,
        },
      });

      return data.access_token;
    } catch (error) {
      if (error instanceof UpsAuthError) {
        throw error;
      }

      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new UpsAuthError(
        `Failed to fetch UPS token: ${message}`,
        'FETCH_ERROR',
        500
      );
    }
  }

  /**
   * Force refresh the token, bypassing cache.
   */
  async refreshToken(): Promise<string> {
    return this.fetchNewToken();
  }

  /**
   * Invalidate the cached token.
   */
  async invalidateToken(): Promise<void> {
    await prisma.systemToken.deleteMany({
      where: { provider: PROVIDER_NAME },
    });
  }
}

// Export singleton instance
export const upsAuthService = new UpsAuthService();

export default upsAuthService;
