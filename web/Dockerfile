# Build context is the repo root (see docker-compose.yml) so npm workspaces resolves correctly.
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY web/package.json ./web/package.json
RUN npm install --workspace web
COPY web ./web
# Vite inlines VITE_* env vars into the built JS at build time — optional, so a plain build
# without it (the default) behaves exactly as before, just without error reporting.
ARG VITE_SENTRY_DSN=""
ENV VITE_SENTRY_DSN=$VITE_SENTRY_DSN
RUN npm run build --workspace web

FROM nginx:1.27-alpine
COPY web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/web/dist /usr/share/nginx/html
EXPOSE 80
