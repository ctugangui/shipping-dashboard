import { prisma } from '../lib/prisma.js';
import { config } from '../config/index.js';

// USPS OAuth Response Interface
interface UspsOAuthResponse {
  access_token: string;
  token_type: string;
  issued_at: number;
  expires_in: number;
  status: string;
  scope: string;
  issuer: string;
  client_id: string;
  application_name: string;
  api_products: string;
  public_key: string;
}

// USPS Error Response Interface
interface UspsErrorResponse {
  error?: string;
  error_description?: string;
  apiError?: {
    error?: {
      code?: string;
      message?: string;
    };
  };
}

// Custom error class for USPS Auth failures
export class UspsAuthError extends Error {
  public readonly code: string;
  public readonly statusCode: number;

  constructor(message: string, code: string, statusCode: number) {
    super(message);
    this.name = 'UspsAuthError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

const PROVIDER_NAME = 'USPS';
const TOKEN_BUFFER_MINUTES = 5;

class UspsAuthService {
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly baseUrl: string;

  constructor() {
    this.clientId = config.usps.clientId;
    this.clientSecret = config.usps.clientSecret;
    this.baseUrl = config.usps.baseUrl;

    if (!this.clientId || !this.clientSecret) {
      console.warn(
        'USPS credentials not configured. Set USPS_CLIENT_ID and USPS_CLIENT_SECRET in .env'
      );
    }
  }

  async getToken(): Promise<string> {
    const existingToken = await this.getCachedToken();
    if (existingToken) {
      return existingToken;
    }
    return this.fetchNewToken();
  }

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

  private async fetchNewToken(): Promise<string> {
    if (!this.clientId || !this.clientSecret) {
      throw new UspsAuthError('USPS credentials not configured', 'MISSING_CREDENTIALS', 500);
    }

    const url = `${this.baseUrl}/oauth2/v3/token`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
        },
        body: new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: this.clientId,
          client_secret: this.clientSecret,
        }).toString(),
      });

      if (!response.ok) {
        const errorBody = (await response.json().catch(() => ({}))) as UspsErrorResponse;
        const errorMessage = errorBody.error_description || errorBody.apiError?.error?.message || `USPS OAuth failed with status ${response.status}`;
        const errorCode = errorBody.error || errorBody.apiError?.error?.code || 'AUTH_FAILED';
        throw new UspsAuthError(errorMessage, errorCode, response.status);
      }

      const data = (await response.json()) as UspsOAuthResponse;
      const expiresAt = new Date(Date.now() + data.expires_in * 1000);

      await prisma.systemToken.upsert({
        where: { provider: PROVIDER_NAME },
        update: { token: data.access_token, expiresAt },
        create: { provider: PROVIDER_NAME, token: data.access_token, expiresAt },
      });

      return data.access_token;
    } catch (error) {
      if (error instanceof UspsAuthError) throw error;
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new UspsAuthError(`Failed to fetch USPS token: ${message}`, 'FETCH_ERROR', 500);
    }
  }

  async refreshToken(): Promise<string> {
    return this.fetchNewToken();
  }

  async invalidateToken(): Promise<void> {
    await prisma.systemToken.deleteMany({ where: { provider: PROVIDER_NAME } });
  }
}

export const uspsAuthService = new UspsAuthService();
export default uspsAuthService;