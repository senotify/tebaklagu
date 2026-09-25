# Leaderboard API (server/index.mjs): no npm dependencies, so no install step.
# Built with `--target api`; the default target below is the web image.
FROM node:22-alpine AS api
WORKDIR /app
COPY server ./server
COPY src/data/generated/index.json ./src/data/generated/index.json
ENV NODE_ENV=production PORT=8787 DB_PATH=/data/scores.db
RUN mkdir -p /data && chown node:node /data
USER node
VOLUME /data
EXPOSE 8787
CMD ["node", "--disable-warning=ExperimentalWarning", "server/index.mjs"]

FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine AS web
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
