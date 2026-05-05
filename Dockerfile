FROM node:22-alpine AS admin-build
WORKDIR /app/admin
COPY admin/package.json admin/package-lock.json ./
RUN npm ci
COPY admin/ ./
RUN npm run build

FROM node:22-alpine
WORKDIR /app

ENV NODE_ENV=production \
    PORT=8787 \
    ADMIN_PORT=3000

COPY server/package.json server/package-lock.json ./
RUN npm ci --omit=dev --omit=optional

COPY server/src ./server/src
COPY server/public ./server/public
COPY server/views ./server/views

COPY css ./css
COPY js ./js
COPY *.html ./

COPY --from=admin-build /app/admin/dist ./admin/dist

RUN mkdir -p server/db server/public/uploads

EXPOSE 8787 3000

CMD ["node", "server/src/index.js"]
