# Ops Manual

Last updated: `2026-05-23`

## Official Production Topology

Production runs on Unraid with two separate containers:

1. `blog`
2. `open-webui`

The `blog` image is built by GitHub Actions and published to GHCR.

The `blog` container must connect to Open WebUI through:

```env
OPEN_WEBUI_URL=http://192.168.3.100:8080
```

## First Deployment

### Prerequisites

- Unraid server is online
- `open-webui` container is already deployed and reachable on port `8080`
- GHCR image is available
- the Unraid template for `blog` is imported from `unraid-template.xml`

### Required Variables for `blog`

- `JWT_SECRET`
- `SESSION_SECRET`
- `ADMIN_EMAIL`
- `ADMIN_PASSWORD` or `ADMIN_PASSWORD_HASH`
- `OPEN_WEBUI_URL`

### Validation

After deployment, verify:

```bash
curl http://192.168.3.100:8787/health
curl http://192.168.3.100:3000/health
curl http://192.168.3.100:8787/api/categories
```

Then confirm in the admin UI:

- `/workbench/health` is reachable
- the workbench loads through the external Open WebUI service
- KB sync can connect to Open WebUI

## Daily Operations

### Update the `blog` Container

1. Push changes to `main`
2. Wait for GitHub Actions to publish the new GHCR image
3. In Unraid, force the `blog` container to pull the latest image
4. Restart the `blog` container

### Check Logs

Use Unraid container logs for the `blog` container.

Focus on:

- startup logs
- `/workbench` proxy errors
- KB sync errors
- Open WebUI connectivity errors

### Check Data Persistence

The following paths must stay mounted:

- `/app/server/db`
- `/app/server/public/uploads`

After updates, verify that:

- the SQLite database still exists
- uploaded files are still accessible
- backups remain available if enabled

## Troubleshooting

### Workbench Fails

Check:

1. `OPEN_WEBUI_URL` is set in the `blog` container
2. the `open-webui` container is healthy
3. the host IP and port in `OPEN_WEBUI_URL` are reachable from the `blog` container

### KB Sync Fails

Check:

1. Open WebUI URL in settings or `OPEN_WEBUI_URL`
2. Open WebUI API key in system settings
3. network reachability from `blog` to `open-webui`

### Blog Starts but Workbench Is Unavailable

This usually means the `blog` container started without `OPEN_WEBUI_URL`.

The current code treats this as a production misconfiguration and skips the embedded launcher.

Fix the container variable and restart `blog`.

## Rollback

If a bad image is deployed:

1. select the previous working image tag in Unraid, or re-pull a known good digest
2. restart the `blog` container
3. verify `8787`, `3000`, and `/workbench/health`
