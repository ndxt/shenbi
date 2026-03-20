/**
 * GitLab integration routes
 *
 * - OAuth login / callback / logout / status
 * - Group project listing / creation
 * - Repository operations (tree, files, commits, branches)
 */

import { Hono } from 'hono';
import { setCookie, getCookie, deleteCookie } from 'hono/cookie';
import type { GitLabOAuthConfig } from '../adapters/gitlab-oauth.ts';
import {
  initiateOAuthLogin,
  handleOAuthCallback,
  getSession,
  destroySession,
} from '../adapters/gitlab-oauth.ts';
import * as gitlab from '../adapters/gitlab-api.ts';
import { createGitLabAuthMiddleware, getGitLabSession, GITLAB_SESSION_COOKIE } from '../middleware/gitlab-auth.ts';
import { logger } from '../adapters/logger.ts';

export function createGitLabRoute(config: GitLabOAuthConfig): Hono {
  const app = new Hono();
  const authMiddleware = createGitLabAuthMiddleware(config);

  // ───────────────────────── OAuth ─────────────────────────

  /** Initiate OAuth login — redirects to GitLab authorization page. */
  app.get('/oauth/login', async (c) => {
    const instanceUrl = c.req.query('instance') || config.defaultInstanceUrl;
    const { authorizationUrl } = await initiateOAuthLogin(config, instanceUrl);
    return c.redirect(authorizationUrl);
  });

  /** OAuth callback — exchanges code for token and sets session cookie. */
  app.get('/oauth/callback', async (c) => {
    const code = c.req.query('code');
    const state = c.req.query('state');
    if (!code || !state) {
      return c.json({ error: 'Missing code or state parameter' }, 400);
    }

    try {
      const session = await handleOAuthCallback(config, code, state);

      // Set HttpOnly session cookie (30 days)
      setCookie(c, GITLAB_SESSION_COOKIE, session.sessionId, {
        httpOnly: true,
        secure: false, // set true in production behind HTTPS
        sameSite: 'Lax',
        path: '/',
        maxAge: 30 * 24 * 60 * 60,
      });

      // Redirect back to the app
      return c.redirect('/');
    } catch (error) {
      logger.error('gitlab.oauth.callback_error', {
        error: error instanceof Error ? error.message : String(error),
      });
      return c.json({ error: 'OAuth authentication failed' }, 500);
    }
  });

  /** Logout — destroys session. */
  app.post('/oauth/logout', (c) => {
    const sessionId = getCookie(c, GITLAB_SESSION_COOKIE);
    if (sessionId) {
      destroySession(sessionId);
      deleteCookie(c, GITLAB_SESSION_COOKIE, { path: '/' });
    }
    return c.json({ ok: true });
  });

  /** Check current login status. */
  app.get('/oauth/status', async (c) => {
    const sessionId = getCookie(c, GITLAB_SESSION_COOKIE);
    if (!sessionId) {
      return c.json({ authenticated: false });
    }
    const session = await getSession(config, sessionId);
    if (!session) {
      return c.json({ authenticated: false });
    }
    return c.json({
      authenticated: true,
      user: {
        id: session.userId,
        username: session.username,
        avatarUrl: session.avatarUrl,
        instanceUrl: session.instanceUrl,
      },
      defaultGroupId: config.defaultGroupId,
    });
  });

  // ───────────────────── Protected routes ──────────────────

  // All routes below require auth
  app.use('/groups/*', authMiddleware);
  app.use('/projects/*', authMiddleware);
  app.use('/projects', authMiddleware);

  // ─────────────────── Group & Projects ────────────────────

  /** List projects under a group. */
  app.get('/groups/:groupId/projects', async (c) => {
    const session = getGitLabSession(c);
    const groupId = c.req.param('groupId');
    const search = c.req.query('search') || undefined;
    const opts = { instanceUrl: session.instanceUrl, accessToken: session.accessToken };
    const projects = await gitlab.listGroupProjects(
      opts,
      groupId,
      search ? { search } : {},
    );
    return c.json(projects);
  });

  /** Create a new project under a group namespace. */
  app.post('/projects', async (c) => {
    const session = getGitLabSession(c);
    const body = (await c.req.json()) as {
      name: string;
      namespaceId: number;
      path?: string;
      description?: string;
    };
    if (!body.name || !body.namespaceId) {
      return c.json({ error: 'name and namespaceId are required' }, 400);
    }
    const opts = { instanceUrl: session.instanceUrl, accessToken: session.accessToken };
    const project = await gitlab.createProject(opts, body.name, body.namespaceId, {
      ...(body.path ? { path: body.path } : {}),
      ...(body.description ? { description: body.description } : {}),
    });
    return c.json(project, 201);
  });

  /** Get a single project. */
  app.get('/projects/:projectId', async (c) => {
    const session = getGitLabSession(c);
    const projectId = c.req.param('projectId');
    const opts = { instanceUrl: session.instanceUrl, accessToken: session.accessToken };
    const project = await gitlab.getProject(opts, projectId);
    return c.json(project);
  });

  // ─────────────────── Repository ops ──────────────────────

  /** Get repository tree. */
  app.get('/projects/:projectId/tree', async (c) => {
    const session = getGitLabSession(c);
    const projectId = c.req.param('projectId');
    const ref = c.req.query('ref') || undefined;
    const path = c.req.query('path') || undefined;
    const recursive = c.req.query('recursive') === 'true';
    const opts = { instanceUrl: session.instanceUrl, accessToken: session.accessToken };
    const tree = await gitlab.getTree(opts, projectId, {
      ...(path ? { path } : {}),
      ...(ref ? { ref } : {}),
      ...(recursive ? { recursive } : {}),
    });
    return c.json(tree);
  });

  /** Read a file from the repository. */
  app.get('/projects/:projectId/files/*', async (c) => {
    const session = getGitLabSession(c);
    const projectId = c.req.param('projectId');
    // Extract file path from the wildcard — everything after /files/
    const url = new URL(c.req.url);
    const prefix = `/projects/${projectId}/files/`;
    const idx = url.pathname.indexOf(prefix);
    const filePath = idx >= 0 ? decodeURIComponent(url.pathname.slice(idx + prefix.length)) : '';
    if (!filePath) {
      return c.json({ error: 'File path is required' }, 400);
    }
    const ref = c.req.query('ref') || undefined;
    const opts = { instanceUrl: session.instanceUrl, accessToken: session.accessToken };
    const file = await gitlab.getFile(opts, projectId, filePath, ref);
    return c.json(file);
  });

  /** Create a commit (batch file push). */
  app.post('/projects/:projectId/commits', async (c) => {
    const session = getGitLabSession(c);
    const projectId = c.req.param('projectId');
    const body = (await c.req.json()) as {
      branch: string;
      commitMessage: string;
      actions: gitlab.GitLabCommitAction[];
    };
    if (!body.branch || !body.commitMessage || !Array.isArray(body.actions) || body.actions.length === 0) {
      return c.json({ error: 'branch, commitMessage, and non-empty actions are required' }, 400);
    }

    logger.info('gitlab.commit.creating', {
      projectId,
      branch: body.branch,
      actionCount: body.actions.length,
      username: session.username,
    });

    const opts = { instanceUrl: session.instanceUrl, accessToken: session.accessToken };
    const result = await gitlab.createCommit(opts, projectId, body.branch, body.commitMessage, body.actions);

    logger.info('gitlab.commit.created', {
      projectId,
      commitId: result.id,
      branch: body.branch,
    });

    return c.json(result, 201);
  });

  /** List branches. */
  app.get('/projects/:projectId/branches', async (c) => {
    const session = getGitLabSession(c);
    const projectId = c.req.param('projectId');
    const opts = { instanceUrl: session.instanceUrl, accessToken: session.accessToken };
    const branches = await gitlab.listBranches(opts, projectId);
    return c.json(branches);
  });

  return app;
}
