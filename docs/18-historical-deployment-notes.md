# Historical Deployment Notes

Last updated: `2026-05-23`

## Purpose

Several planning documents in this repository still describe an older production strategy based on Docker Compose or `deploy.sh`.

Those documents are useful as historical context, but they are no longer the official production deployment reference.

## Documents to Treat as Historical

- `docs/15-phase5-launch-plan.md`
- `docs/05-implementation-plan.md`
- `docs/05a-github-issues-template.md`

## Current Official Production Path

Use this path instead:

1. Push code to GitHub
2. GitHub Actions publishes the `blog` image to GHCR
3. Unraid deploys the `blog` container from the published image
4. `open-webui` runs as a separate container
5. `blog` connects to Open WebUI through `OPEN_WEBUI_URL`

Current recommended value:

```env
OPEN_WEBUI_URL=http://192.168.3.100:8080
```

## Canonical References

Use these files as the current source of truth:

- `README.md`
- `AGENTS.md`
- `unraid-template.xml`
- `deploy-unraid.sh`
- `docs/16-ops-manual.md`
- `docs/17-release-checklist.md`
- `docs/open-webui-integration.md`
