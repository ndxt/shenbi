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

      // Redirect to success page (for popup flow)
      return c.redirect('/api/gitlab/oauth/success');
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      logger.error('gitlab.oauth.callback_error', {
        error: errMsg,
        code: code?.slice(0, 8) + '...',
        state: state?.slice(0, 8) + '...',
      });
      return c.json({ error: `OAuth authentication failed: ${errMsg}` }, 500);
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
      return c.json({ authenticated: false, defaultInstanceUrl: config.defaultInstanceUrl });
    }
    const session = await getSession(config, sessionId);
    if (!session) {
      return c.json({ authenticated: false, defaultInstanceUrl: config.defaultInstanceUrl });
    }
    const absoluteAvatarUrl = session.avatarUrl.startsWith('http')
      ? session.avatarUrl
      : `${session.instanceUrl.replace(/\/+$/, '')}${session.avatarUrl.startsWith('/') ? '' : '/'}${session.avatarUrl}`;

    const avatarUrl = `/api/gitlab/avatar?url=${encodeURIComponent(absoluteAvatarUrl)}`;
      
    return c.json({
      authenticated: true,
      user: {
        id: session.userId,
        username: session.username,
        avatarUrl,
        instanceUrl: session.instanceUrl,
      },
      defaultGroupId: config.defaultGroupId,
      defaultInstanceUrl: config.defaultInstanceUrl,
    });
  });

  /** OAuth success page — closes popup and notifies owner. */
  app.get('/oauth/success', (c) => {
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Login Successful</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #f9f9f9; color: #333; }
            .card { background: white; padding: 2rem; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); text-align: center; }
            h1 { font-size: 1.5rem; margin-bottom: 1rem; color: #2ecc71; }
            p { color: #666; margin-bottom: 1.5rem; }
            .loader { border: 3px solid #f3f3f3; border-top: 3px solid #3498db; border-radius: 50%; width: 24px; height: 24px; animation: spin 1s linear infinite; margin: 0 auto; }
            @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
          </style>
        </head>
        <body>
          <div class="card">
            <h1>授权成功</h1>
            <p>登录成功，正在关闭窗口并返回 IDE...</p>
            <div class="loader"></div>
          </div>
          <script>
            // Notify the parent window (legacy popup logic)
            if (window.opener) {
              window.opener.postMessage('gitlab-login-success', '*');
            }
            // Global broadcast for all components (same-origin tabs/iframes)
            try {
              const channel = new BroadcastChannel('gitlab-auth');
              channel.postMessage('login-success');
              channel.close();
            } catch (e) {
              console.error('Failed to broadcast login success:', e);
            }
            // Close after a short delay so the user sees the success message
            setTimeout(() => {
              window.close();
            }, 1000);
          </script>
        </body>
      </html>
    `;
    return c.html(html);
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

  // ─────────────────── Avatar Proxy ────────────────────────

  /** Proxy GitLab avatar requests to handle authentication/CORS. */
  app.get('/avatar', async (c) => {
    const session = getGitLabSession(c);
    const url = c.req.query('url');
    if (!url) return c.json({ error: 'url is required' }, 400);

    // Security: Only proxy from the same instance
    if (!url.startsWith(session.instanceUrl)) {
      return c.json({ error: 'Forbidden: URL must be from the same GitLab instance' }, 403);
    }

    try {
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${session.accessToken}` },
      });

      if (!response.ok) {
        return c.json({ error: `Failed to fetch avatar: ${response.status}` }, response.status as any);
      }

      const contentType = response.headers.get('Content-Type') || 'image/png';
      const arrayBuffer = await response.arrayBuffer();
      
      return c.body(arrayBuffer, 200, {
        'Content-Type': contentType,
        'Cache-Control': 'max-age=3600, public',
      });
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      return c.json({ error: `Avatar proxy failed: ${errMsg}` }, 500);
    }
  });

  return app;
}
