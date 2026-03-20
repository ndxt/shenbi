/**
 * GitLab OAuth2 session/token management
 *
 * Stores per-session tokens in memory.  For production with multiple
 * server instances, replace the Map with Redis or a shared store.
 */

import { logger } from './logger.ts';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GitLabOAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  defaultInstanceUrl: string;
  defaultGroupId: number | undefined;
}

export interface OAuthSession {
  sessionId: string;
  instanceUrl: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: number;         // Unix ms
  userId: number;
  username: string;
  avatarUrl: string;
}

interface PendingAuth {
  instanceUrl: string;
  state: string;
  codeVerifier: string;
  createdAt: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generateId(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

function generateCodeVerifier(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return base64url(bytes);
}

async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return base64url(new Uint8Array(digest));
}

function base64url(bytes: Uint8Array): string {
  const binary = String.fromCharCode(...bytes);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// ---------------------------------------------------------------------------
// Token Store (in-memory, keyed by session ID)
// ---------------------------------------------------------------------------

const sessions = new Map<string, OAuthSession>();
const pendingAuths = new Map<string, PendingAuth>();

// Auto-cleanup stale pending auths (older than 10 min)
setInterval(() => {
  const cutoff = Date.now() - 10 * 60 * 1000;
  for (const [state, pending] of pendingAuths) {
    if (pending.createdAt < cutoff) {
      pendingAuths.delete(state);
    }
  }
}, 60_000);

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Initiate an OAuth login flow.
 * Returns the GitLab authorization URL to redirect the user to.
 */
export async function initiateOAuthLogin(
  config: GitLabOAuthConfig,
  instanceUrl?: string,
): Promise<{ authorizationUrl: string; sessionId: string }> {
  const instance = (instanceUrl?.trim() || config.defaultInstanceUrl).replace(/\/+$/, '');
  const state = generateId();
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = await generateCodeChallenge(codeVerifier);
  const sessionId = generateId();

  pendingAuths.set(state, {
    instanceUrl: instance,
    state,
    codeVerifier,
    createdAt: Date.now(),
  });

  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: 'code',
    state,
    scope: 'api',
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  });

  const authorizationUrl = `${instance}/oauth/authorize?${params.toString()}`;

  logger.info('gitlab.oauth.login_initiated', { instanceUrl: instance, state });

  return { authorizationUrl, sessionId };
}

/**
 * Handle the OAuth callback: exchange the authorization code for tokens.
 */
export async function handleOAuthCallback(
  config: GitLabOAuthConfig,
  code: string,
  state: string,
): Promise<OAuthSession> {
  const pending = pendingAuths.get(state);
  if (!pending) {
    throw new Error('Invalid or expired OAuth state');
  }
  pendingAuths.delete(state);

  const instance = pending.instanceUrl;

  // Exchange code for token
  const tokenResponse = await fetch(`${instance}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code,
      grant_type: 'authorization_code',
      redirect_uri: config.redirectUri,
      code_verifier: pending.codeVerifier,
    }),
  });

  if (!tokenResponse.ok) {
    const body = await tokenResponse.text().catch(() => '');
    logger.error('gitlab.oauth.token_exchange_failed', {
      status: tokenResponse.status,
      body: body.slice(0, 500),
      tokenUrl: `${instance}/oauth/token`,
      redirectUri: config.redirectUri,
      clientIdPrefix: config.clientId.slice(0, 8) + '...',
    });
    throw new Error(`OAuth token exchange failed: ${tokenResponse.status} — ${body.slice(0, 200)}`);
  }

  const tokenData = (await tokenResponse.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
    token_type: string;
  };

  // Fetch user info
  const userResponse = await fetch(`${instance}/api/v4/user`, {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });
  if (!userResponse.ok) {
    throw new Error(`Failed to fetch user info: ${userResponse.status}`);
  }
  const userData = (await userResponse.json()) as {
    id: number;
    username: string;
    avatar_url: string;
  };

  const sessionId = generateId();
  const session: OAuthSession = {
    sessionId,
    instanceUrl: instance,
    accessToken: tokenData.access_token,
    refreshToken: tokenData.refresh_token,
    expiresAt: Date.now() + tokenData.expires_in * 1000,
    userId: userData.id,
    username: userData.username,
    avatarUrl: userData.avatar_url,
  };

  sessions.set(sessionId, session);
  logger.info('gitlab.oauth.login_success', { username: userData.username, instance });

  return session;
}

/**
 * Get an active session, refreshing the token if expired.
 */
export async function getSession(
  config: GitLabOAuthConfig,
  sessionId: string,
): Promise<OAuthSession | undefined> {
  const session = sessions.get(sessionId);
  if (!session) {
    return undefined;
  }

  // Refresh if within 60s of expiry
  if (session.expiresAt - Date.now() < 60_000) {
    try {
      const refreshed = await refreshAccessToken(config, session);
      sessions.set(sessionId, refreshed);
      return refreshed;
    } catch (error) {
      logger.warn('gitlab.oauth.refresh_failed', {
        sessionId,
        error: error instanceof Error ? error.message : String(error),
      });
      sessions.delete(sessionId);
      return undefined;
    }
  }

  return session;
}

/**
 * Destroy a session (logout).
 */
export function destroySession(sessionId: string): void {
  sessions.delete(sessionId);
  logger.info('gitlab.oauth.logout', { sessionId });
}

// ---------------------------------------------------------------------------
// Token refresh
// ---------------------------------------------------------------------------

async function refreshAccessToken(
  config: GitLabOAuthConfig,
  session: OAuthSession,
): Promise<OAuthSession> {
  const response = await fetch(`${session.instanceUrl}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: session.refreshToken,
      grant_type: 'refresh_token',
      redirect_uri: config.redirectUri,
    }),
  });

  if (!response.ok) {
    throw new Error(`Token refresh failed: ${response.status}`);
  }

  const data = (await response.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  };

  logger.info('gitlab.oauth.token_refreshed', { sessionId: session.sessionId });

  return {
    ...session,
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };
}
