# Release Checklist

Last updated: `2026-05-23`

## Before Push

- confirm local code changes are the intended release scope
- confirm `OPEN_WEBUI_URL` assumptions still match production
- confirm no one plans to use `deploy.sh` or `docker-compose.yml` as the production entrypoint

## GitHub and Image Publish

1. push the target branch to GitHub
2. wait for GitHub Actions to finish publishing the `blog` image to GHCR
3. confirm the expected tag or digest exists

## Unraid `blog` Container Variables

Verify the `blog` container has:

- `JWT_SECRET`
- `SESSION_SECRET`
- `ADMIN_EMAIL`
- `ADMIN_PASSWORD` or `ADMIN_PASSWORD_HASH`
- `OPEN_WEBUI_URL=http://192.168.3.100:8080`

Recommended checks:

- `JWT_SECRET` is not empty and is long random text
- `SESSION_SECRET` is not empty and is long random text
- `ADMIN_PASSWORD` is not a default weak password if `ADMIN_PASSWORD_HASH` is unused

## Unraid Topology

Verify:

- `blog` container is configured from the GHCR image
- `open-webui` container is already running independently
- `open-webui` is reachable on `192.168.3.100:8080`
- `blog` still mounts `/app/server/db`
- `blog` still mounts `/app/server/public/uploads`

## After Pull and Restart

Run:

```powershell
Invoke-RestMethod http://192.168.3.100:8787/health
Invoke-RestMethod http://192.168.3.100:3000/health
Invoke-RestMethod http://192.168.3.100:8787/api/categories
```

Expected:

- front health returns success
- admin health returns success
- categories API returns normal JSON

## Admin Verification

After logging into the admin UI, verify:

- the admin SPA loads normally
- `/workbench/health` reports a reachable external Open WebUI target
- the workbench page opens successfully
- Open WebUI connection test passes
- one KB sync test can complete or at least reach Open WebUI correctly

## Data Persistence Check

Verify after restart:

- existing SQLite data is still present
- uploaded media is still accessible
- existing backups are still present if backup jobs were used before

## Rollback Trigger

Rollback immediately if any of these happen:

- `blog` starts but `3000` or `8787` health checks fail
- `/workbench` consistently returns `503`
- KB sync fails due to unreachable Open WebUI after confirming credentials
- mounted data is missing

## Rollback Action

1. switch Unraid back to the previous known-good image tag or digest
2. restart the `blog` container
3. rerun the three HTTP checks
4. verify admin login and `/workbench/health` again
