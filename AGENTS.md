# Production Deployment Flow

## Source Repository

Local project path: `C:\Users\陈科\MyProject\blog-design-v2.0`

## Official Production Path

Production is deployed through GitHub Container Registry and Unraid templates.

1. Push code to GitHub.
2. GitHub Actions builds and publishes the `blog` image to GHCR.
3. Unraid pulls the latest image for the `blog` container.
4. `open-webui` runs as a separate container.
5. The `blog` container connects to `open-webui` through `OPEN_WEBUI_URL`, using the Unraid host IP and exposed port.

## Production Topology

- `blog` container:
  - frontend on `8787`
  - admin SPA and API on `3000`
- `open-webui` container:
  - exposed separately on `8080`
- container-to-service connection:
  - `OPEN_WEBUI_URL=http://192.168.3.100:8080`

## Required Production Variables

The `blog` container must be configured with:

- `JWT_SECRET`
- `SESSION_SECRET`
- `ADMIN_EMAIL`
- `ADMIN_PASSWORD` or `ADMIN_PASSWORD_HASH`
- `OPEN_WEBUI_URL`

Recommended value for this environment:

```env
OPEN_WEBUI_URL=http://192.168.3.100:8080
```

## Unraid Deployment Notes

- The official production entrypoint is the Unraid template in `unraid-template.xml`.
- `deploy-unraid.sh` is a helper script for manual Unraid-side deployment and should use the same variables as the template.
- The legacy SSH + `scp` + remote `docker build` workflow is no longer the official production path.

## Validation After Release

After Unraid pulls and restarts the `blog` container, verify:

```powershell
Invoke-RestMethod http://192.168.3.100:8787/health
Invoke-RestMethod http://192.168.3.100:3000/health
Invoke-RestMethod http://192.168.3.100:8787/api/categories
```

Then log into the admin UI and confirm:

- `/workbench/health` reports the external Open WebUI target
- knowledge base sync can reach Open WebUI
- uploaded files and SQLite data remain mounted
