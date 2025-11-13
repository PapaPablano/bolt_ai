import { SchwabConfig } from '../schwab-api/types'

type PartialEnv = {
  SCHWAB_CLIENT_ID?: string
  SCHWAB_CLIENT_SECRET?: string
  SCHWAB_REDIRECT_URI?: string
  SCHWAB_SCOPE?: string
}

export function loadSchwabConfig(env: PartialEnv = process.env): SchwabConfig {
  const clientId = env.SCHWAB_CLIENT_ID
  const clientSecret = env.SCHWAB_CLIENT_SECRET
  const redirectUri = env.SCHWAB_REDIRECT_URI

  if (!clientId || !clientSecret || !redirectUri) {
    const missingVars = [];
    if (!clientId) missingVars.push('SCHWAB_CLIENT_ID');
    if (!clientSecret) missingVars.push('SCHWAB_CLIENT_SECRET');
    if (!redirectUri) missingVars.push('SCHWAB_REDIRECT_URI');
    throw new Error(
      `Missing required Schwab OAuth environment variables: ${missingVars.join(', ')}. Please set SCHWAB_CLIENT_ID, SCHWAB_CLIENT_SECRET, and SCHWAB_REDIRECT_URI.`
    );
  }

  return {
    clientId,
    clientSecret,
    redirectUri,
    scope: env.SCHWAB_SCOPE ?? 'readonly',
  }
}
