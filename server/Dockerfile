FROM node:24-alpine

WORKDIR /app

COPY server/package.json ./server/package.json
COPY server/src ./server/src
COPY server/public ./server/public
COPY etf-sector-extension ./etf-sector-extension

WORKDIR /app/server
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=8787
ENV DATA_DIR=/data

EXPOSE 8787

CMD ["node", "src/server.js"]
