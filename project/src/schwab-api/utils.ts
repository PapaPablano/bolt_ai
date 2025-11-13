import { OAuthToken, SchwabRequestOptions, TokenResponse } from './types'

export const SCHWAB_API_BASE_URL = 'https://api.schwabapi.com/marketdata/v1'
export const SCHWAB_OAUTH_BASE_URL = 'https://api.schwabapi.com/v1/oauth'
export const SCHWAB_STREAMER_DEFAULT_HEARTBEAT_MS = 10_000

export function buildUrl(options: SchwabRequestOptions, defaultBase = SCHWAB_API_BASE_URL): string {
  const baseUrl = options.baseUrl ?? defaultBase
  const url = new URL(options.path, baseUrl)

  if (options.query) {
    for (const [key, value] of Object.entries(options.query)) {
      if (value !== undefined && value !== null) {
        url.searchParams.set(key, String(value))
      }
    }
  }

  return url.toString()
}

export function toOAuthToken(payload: TokenResponse): OAuthToken {
  return {
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token,
    expiresAt: Math.floor(Date.now() / 1000) + payload.expires_in,
    scope: payload.scope,
    tokenType: payload.token_type,
  }
}

export function isTokenExpired(expiresAt: number, skewSeconds = 60): boolean {
  const nowSeconds = Math.floor(Date.now() / 1000)
  return nowSeconds >= expiresAt - skewSeconds
}

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
