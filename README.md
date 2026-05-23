# ifoxchen.com Blog v2

Personal blog project with:

- Express 5 + SQLite backend
- static HTML/CSS/JS public site
- Vue 3 admin SPA
- external Open WebUI integration for workbench and knowledge-base sync

## Local Development

### Install dependencies

```bash
cd server && npm install
cd ../admin && npm install
```

### Environment

```bash
cp server/.env.example server/.env
```

Set at least:

- `ADMIN_EMAIL`
- `ADMIN_PASSWORD` or `ADMIN_PASSWORD_HASH`
- `JWT_SECRET`
- `SESSION_SECRET`

### Start services

Backend:

```bash
cd server && npm run dev
```

Admin dev server:

```bash
cd admin && npm run dev
```

## Official Production Deployment

The official production path is:

1. Push code to GitHub
2. GitHub Actions builds and publishes the `blog` image to GHCR
3. Unraid pulls and deploys the `blog` image through the Unraid template
4. `open-webui` runs as a separate container
5. `blog` connects to Open WebUI through `OPEN_WEBUI_URL`

Recommended production value in the current environment:

```env
OPEN_WEBUI_URL=http://192.168.3.100:8080
```

Production references:

- `unraid-template.xml`
- `deploy-unraid.sh`
- `docs/16-ops-manual.md`
- `docs/17-release-checklist.md`
- `docs/open-webui-integration.md`

## Notes

- `deploy.sh` is legacy and no longer the official production deployment path.
- `docker-compose.yml` is for local or integration testing, not the official Unraid production entrypoint.
