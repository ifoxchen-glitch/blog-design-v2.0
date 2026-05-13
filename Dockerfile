FROM node:22-alpine AS admin-build
WORKDIR /app/admin
COPY admin/package.json admin/package-lock.json ./
RUN npm ci
COPY admin/ ./
RUN npm run build

FROM node:22-alpine AS admin-build
WORKDIR /app/admin
COPY admin/package.json admin/package-lock.json ./
RUN npm ci
COPY admin/ ./
RUN npm run build

# ---- Python stage for Open WebUI ----
FROM python:3.11-alpine AS python-deps
WORKDIR /app
COPY server/open-webui/backend/requirements.txt ./
RUN apk add --no-cache gcc musl-dev linux-headers && \
    pip install --no-cache-dir -r requirements.txt

FROM node:22-alpine
WORKDIR /app

# Install Python runtime (needed for Open WebUI child process)
RUN apk add --no-cache python3 py3-pip

ENV NODE_ENV=production \
    PORT=8787 \
    ADMIN_PORT=3000 \
    OPEN_WEBUI_PORT=8080 \
    OPEN_WEBUI_HOST=127.0.0.1

COPY server/package.json server/package-lock.json ./
RUN npm ci --omit=dev --omit=optional

COPY server/src ./server/src
COPY server/public ./server/public
COPY server/views ./server/views
COPY server/open-webui ./server/open-webui

# Install Python dependencies for Open WebUI
COPY --from=python-deps /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=python-deps /usr/local/bin /usr/local/bin

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
