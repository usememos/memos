// In-memory storage for access token (not persisted for security)
let accessToken: string | null = null;
let tokenExpiresAt: Date | null = null;

export const getAccessToken = (): string | null => accessToken;

export const setAccessToken = (token: string | null, expiresAt?: Date): void => {
  accessToken = token;
  tokenExpiresAt = expiresAt || null;
};

export const isTokenExpired = (): boolean => {
  if (!tokenExpiresAt) return true;
  // Consider expired 30 seconds before actual expiry for safety
  return new Date() >= new Date(tokenExpiresAt.getTime() - 30000);
};

export const clearAccessToken = (): void => {
  accessToken = null;
  tokenExpiresAt = null;
};
