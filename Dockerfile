FROM node:22-alpine AS admin-build
WORKDIR /app/admin
COPY admin/package.json admin/package-lock.json ./
RUN npm ci
COPY admin/ ./
RUN npm run build

FROM node:22-alpine
WORKDIR /app

# Install Python runtime and basic deps (Open WebUI will install its own deps at runtime)
RUN apk add --no-cache python3 py3-pip gcc musl-dev linux-headers libffi-dev

ENV NODE_ENV=production \
    PORT=8787 \
    ADMIN_PORT=3000 \
    OPEN_WEBUI_PORT=8080 \
    OPEN_WEBUI_HOST=127.0.0.1 \
    # Disable Open WebUI features that require heavy deps for now
    ENABLE_RAG_WEB_SEARCH=false \
    ENABLE_IMAGE_GENERATION=false \
    ENABLE_SPEECH_OPENAI=false

COPY server/package.json server/package-lock.json ./
RUN npm ci --omit=dev --omit=optional

COPY server/src ./server/src
COPY server/public ./server/public
COPY server/views ./server/views
COPY server/open-webui ./server/open-webui

# Install minimal Python dependencies for Open WebUI
# Full deps will be installed at runtime on first start
COPY server/open-webui/backend/requirements.txt ./requirements.txt
RUN pip3 install --no-cache-dir --break-system-packages \
    fastapi uvicorn pydantic python-multipart \
    sqlalchemy aiosqlite alembic peewee \
    requests aiohttp aiocache aiofiles httpx \
    bcrypt cryptography PyJWT authlib \
    chromadb sentence-transformers || true

COPY css ./css
COPY js ./js
COPY *.html ./

COPY --from=admin-build /app/admin/dist ./admin/dist

RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 -G nodejs && \
    mkdir -p server/db server/public/uploads server/open-webui/backend/data && \
    chown -R nodejs:nodejs server/db server/public/uploads server/open-webui/backend/data

USER nodejs

EXPOSE 8787 3000

CMD ["node", "server/src/index.js"]
