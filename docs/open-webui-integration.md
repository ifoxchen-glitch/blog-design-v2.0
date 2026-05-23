# Open WebUI Integration

## Overview

The project uses Open WebUI as an external service for the admin workbench and knowledge-base sync features.

Official production topology:

- `blog` container:
  - serves the public blog on `8787`
  - serves the admin SPA and API on `3000`
- `open-webui` container:
  - runs independently
  - is exposed separately on `8080`
- connection method:
  - the `blog` container reaches Open WebUI through `OPEN_WEBUI_URL`
  - in production this should use the Unraid host IP and exposed port

Example:

```env
OPEN_WEBUI_URL=http://192.168.3.100:8080
```

## Request Flow

```text
admin user -> /workbench -> Express proxy in blog container -> OPEN_WEBUI_URL -> open-webui container
```

The JWT bridge is handled by:

- `server/src/middleware/openWebUIAuth.js`
- `server/src/apps/adminApp.js`

Knowledge-base sync uses:

- `server/src/services/kbSync.js`
- `server/src/apps/admin/kb/syncHandlers.js`

## Development Mode

Development can still use the embedded launcher path from the checked-in `server/open-webui` submodule.

Typical local setup:

1. Install Python dependencies inside `server/open-webui/backend`
2. Run `cd server && npm run dev`
3. If `OPEN_WEBUI_URL` is not set, the launcher may try to start the local Python Open WebUI process

## Production Mode

Production should not rely on the embedded launcher.

Instead:

1. GitHub Actions builds the `blog` image and publishes it to GHCR
2. Unraid pulls that image for the `blog` container
3. `open-webui` is deployed separately
4. The `blog` container must receive `OPEN_WEBUI_URL`

Required production environment variables for the `blog` container:

```env
OPEN_WEBUI_URL=http://192.168.3.100:8080
JWT_SECRET=<generate-a-long-random-value>
SESSION_SECRET=<generate-a-long-random-value>
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=<set-a-real-password>
```

## Troubleshooting

### Workbench returns 503

Check:

1. `OPEN_WEBUI_URL` is set in the `blog` container
2. the Open WebUI container is reachable from the `blog` container
3. `/workbench/health` returns the expected external target

### KB sync connection test fails

Check:

1. the Open WebUI URL in system settings or `OPEN_WEBUI_URL`
2. the Open WebUI API key configured in admin settings
3. that the Open WebUI service is reachable on the configured host and port

### Embedded Python launcher starts unexpectedly in production

This means `OPEN_WEBUI_URL` was missing from the `blog` container environment.

Fix the Unraid template or container variables and restart the `blog` container.
