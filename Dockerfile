FROM node:22-alpine

WORKDIR /app
COPY deploy-server.mjs cloudflare-worker.js package.json README.md ./

ENV HOST=0.0.0.0
ENV PORT=8787
EXPOSE 8787

CMD ["node", "deploy-server.mjs"]

