import { OAuthToken, SchwabConfig, TokenResponse } from './types.js'
import {
  SCHWAB_OAUTH_BASE_URL,
  buildUrl,
  delay,
  isTokenExpired,
  toOAuthToken,
} from './utils.js'

const AUTHORIZATION_URL = 'https://api.schwabapi.com/v1/oauth/authorize'

export interface TokenStorage {
  read: () => Promise<OAuthToken | null>
  write: (token: OAuthToken) => Promise<void>
  clear: () => Promise<void>
}

export class SchwabOAuth {
  private config: SchwabConfig
  private storage: TokenStorage

  constructor(config: SchwabConfig, storage: TokenStorage) {
    this.config = config
    this.storage = storage
  }

  buildAuthorizationUrl(state?: string): string {
    const scope = this.config.scope ?? 'readonly'
    const url = new URL(AUTHORIZATION_URL)
    url.searchParams.set('response_type', 'code')
    url.searchParams.set('client_id', this.config.clientId)
    url.searchParams.set('redirect_uri', this.config.redirectUri)
    url.searchParams.set('scope', scope)
    if (state) {
      url.searchParams.set('state', state)
    }
    return url.toString()
  }

  async getToken(): Promise<OAuthToken> {
    const token = await this.storage.read()

    if (token && !isTokenExpired(token.expiresAt)) {
      return token
    }

    if (token?.refreshToken) {
      return this.refresh(token.refreshToken)
    }

    throw new Error('OAuth token is not available. Please initiate the authorization flow by calling buildAuthorizationUrl() and exchanging the authorization code.')
  }

  async exchange(code: string): Promise<OAuthToken> {
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: this.config.redirectUri,
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
    })

    const token = await this.requestToken(body)
    await this.storage.write(token)
    return token
  }

  async refresh(refreshToken: string): Promise<OAuthToken> {
    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
    })

    try {
      const token = await this.requestToken(body)
      await this.storage.write(token)
      return token
    } catch (error) {
      await this.storage.clear()
      throw error
    }
  }

  private async requestToken(body: URLSearchParams): Promise<OAuthToken> {
    const response = await fetch(buildUrl({ path: 'token' }, SCHWAB_OAUTH_BASE_URL), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
    })

    if (!response.ok) {
      if (response.status === 429) {
        await delay(1000)
        return this.requestToken(body)
      }

      const payload = await response.text()
      throw new Error(`Schwab OAuth request failed: ${response.status} ${payload}`)
    }

    const payload = (await response.json()) as TokenResponse
    return toOAuthToken(payload)
  }
}
