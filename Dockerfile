FROM node:22-alpine

WORKDIR /app

ENV NODE_ENV=production \
    PORT=8787

COPY server/package.json server/package-lock.json ./
RUN npm ci --omit=dev --omit=optional

COPY server/src ./server/src
COPY server/public ./server/public
COPY server/views ./server/views

COPY css ./css
COPY js ./js
COPY *.html ./

RUN mkdir -p server/db server/public/uploads

EXPOSE 8787

CMD ["node", "server/src/index.js"]
