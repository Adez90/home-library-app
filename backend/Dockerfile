# Build context is the repo root (see docker-compose.yml) so npm workspaces resolves correctly.
FROM node:22-alpine AS build
WORKDIR /app
# Without this, `prisma generate` can't detect which OpenSSL is present and silently falls
# back to a guess (usually wrong on current Alpine), producing an engine binary that fails
# at runtime with an opaque "could not parse schema engine response" error.
RUN apk add --no-cache openssl
COPY package.json package-lock.json ./
COPY backend/package.json ./backend/package.json
RUN npm install --workspace backend
COPY backend ./backend
RUN npx prisma generate --schema backend/prisma/schema.prisma
RUN npm run build --workspace backend

FROM node:22-alpine
WORKDIR /app
# Same reason as the build stage — the generated engine binary needs a real OpenSSL present
# at runtime too, both to run at all and for `prisma migrate deploy` in the CMD below.
RUN apk add --no-cache openssl
ENV NODE_ENV=production
COPY package.json package-lock.json ./
COPY backend/package.json ./backend/package.json
RUN npm install --workspace backend --omit=dev
COPY --from=build /app/backend/dist ./backend/dist
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY backend/prisma ./backend/prisma

WORKDIR /app/backend
EXPOSE 3000
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/server.js"]
