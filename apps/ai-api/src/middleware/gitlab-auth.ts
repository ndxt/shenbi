/**
 * GitLab session auth middleware.
 *
 * Reads the `gitlab_session` cookie and resolves the corresponding
 * OAuthSession.  Attaches `gitlabSession` to the Hono context so
 * downstream route handlers can access the user's access token.
 */

import { createMiddleware } from 'hono/factory';
import { getCookie } from 'hono/cookie';
import type { GitLabOAuthConfig, OAuthSession } from '../adapters/gitlab-oauth.ts';
import { getSession } from '../adapters/gitlab-oauth.ts';

export const GITLAB_SESSION_COOKIE = 'gitlab_session';

/**
 * Creates a middleware that populates `c.get('gitlabSession')` from the
 * session cookie.  If the session is missing or expired (and cannot be
 * refreshed) it returns 401.
 */
export function createGitLabAuthMiddleware(config: GitLabOAuthConfig) {
  return createMiddleware(async (c, next) => {
    const sessionId = getCookie(c, GITLAB_SESSION_COOKIE);
    if (!sessionId) {
      return c.json({ error: 'Not authenticated with GitLab' }, 401);
    }

    const session = await getSession(config, sessionId);
    if (!session) {
      return c.json({ error: 'GitLab session expired, please login again' }, 401);
    }

    c.set('gitlabSession' as never, session);
    await next();
  });
}

/** Helper to extract the resolved session from context. */
export function getGitLabSession(c: { get(key: string): unknown }): OAuthSession {
  return c.get('gitlabSession' as never) as OAuthSession;
}
