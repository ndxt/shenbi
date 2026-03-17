# AI API Deployment

## Build Output

Run:

```bash
pnpm --filter @shenbi/ai-api build
```

The build produces:

- `dist/server.cjs`
- `dist/.env.production`

`dist/.env.production` is copied from workspace root `.env.production` when present, otherwise `.env.local`.

## Publish Path

Server deploy directory:

```bash
/nfsdata/pvc-27cefccb-6a40-42a8-ac16-811e20e301af/shenbi-api
```

The current publish flow uploads `dist/*` directly into that directory root, so the runtime files on server are:

- `/nfsdata/pvc-27cefccb-6a40-42a8-ac16-811e20e301af/shenbi-api/server.cjs`
- `/nfsdata/pvc-27cefccb-6a40-42a8-ac16-811e20e301af/shenbi-api/.env.production`

## Node

Server is using Node `v22.16.0`.

Recommended executable path:

```bash
/usr/local/bin/node
```

## Systemd

Service file:

```ini
[Unit]
Description=Shenbi AI API
After=network.target

[Service]
Type=simple
User=front
Group=front
WorkingDirectory=/nfsdata/pvc-27cefccb-6a40-42a8-ac16-811e20e301af/shenbi-api
EnvironmentFile=/nfsdata/pvc-27cefccb-6a40-42a8-ac16-811e20e301af/shenbi-api/.env.production
ExecStart=/usr/local/bin/node /nfsdata/pvc-27cefccb-6a40-42a8-ac16-811e20e301af/shenbi-api/server.cjs
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Reload and restart:

```bash
sudo systemctl daemon-reload
sudo systemctl restart shenbi-ai-api
sudo systemctl status shenbi-ai-api --no-pager
```

Logs:

```bash
sudo journalctl -u shenbi-ai-api -n 50 --no-pager
sudo journalctl -u shenbi-ai-api -f
```

## Health Check

```bash
curl http://127.0.0.1:3100/health
```

Expected response:

```json
{"status":"ok"}
```

## Workspace Scripts

From repository root:

```bash
pnpm reset:ai-api
pnpm publish:preview
```

`reset:ai-api` restarts the remote service over SSH, retries health checks up to 10 times, and prints logs if startup fails.
