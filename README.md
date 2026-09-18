# Home Library App

Catalog the books you own, see which volumes are missing from a series, and keep a shared
household wishlist — built to answer "do we already have this?" while standing in a secondhand
bookshop.

- **Blueprint** (architecture, data model, roadmap): https://claude.ai/artifact/f8ba237c-35eb-49e6-83d0-b7abac825b61
- **User guide** (fills in as features ship, with real screenshots): https://claude.ai/artifact/9LBhyAsX7Yx3wqPWHJCvdp

## Layout

This is a monorepo:

```
backend/   Fastify + Prisma + PostgreSQL API
web/       React + Tailwind frontend, responsive (phone/tablet/desktop)
mobile/    React Native app (later)
```

## Status

- [x] Users, households, invite-code sharing, login/session auth
- [x] Book catalog: ISBN lookup (Open Library / Google Books), manual entry fallback
- [x] Series completion tracking
- [x] Wishlist / favorites
- [x] Web frontend (login, scan/add, library, series, wishlist)
- [ ] Multi-book shelf scan
- [ ] Native app

## Local development

Requires Node 22+ and a PostgreSQL server.

```bash
npm install                       # installs both workspaces
cd backend && cp .env.example .env && cd ..
npx prisma migrate dev --schema backend/prisma/schema.prisma

npm run backend:dev               # API on :3000
npm run web:dev                   # frontend on :5173, proxies /api to :3000
```

Run the test suites:

```bash
npm run backend:test              # needs DATABASE_URL reachable
npm run web:test
```

### Running everything with Docker

```bash
docker compose up -d db
cd backend && npx prisma migrate deploy && cd ..
docker compose up -d api web
```

The `web` service serves the built frontend via nginx on `:8080` and proxies `/api/*` to the
`api` service. Put your own TLS-terminating reverse proxy (nginx + Let's Encrypt on your domain)
in front of port 8080 for production.

## Accounts

Registering without an `inviteCode` creates a new household and makes you its owner. To add a
second person to the *same* household (e.g. sharing with your partner), have them register with
the `inviteCode` from `GET /auth/me` (or the register/login response) — they join as a `member`
of the same household instead of creating their own.

## Known limitations

- Manually-added books (no ISBN) aren't deduplicated across households by title — two households
  entering "the same" book by hand get two catalog rows. ISBN-based adds don't have this problem.
- Series pages only know about volumes someone has looked up or added; there's no external
  "this series has 7 books" source yet (planned: Wikidata).
- Open Library / Google Books lookups are unit-tested against fixtures, not live network calls,
  to keep CI fast and deterministic.
