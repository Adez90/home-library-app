# Home Library App

Catalog the books you own, see which volumes are missing from a series, and keep a shared
household wishlist — built to answer "do we already have this?" while standing in a secondhand
bookshop.

- **Blueprint** (architecture, data model, roadmap): https://claude.ai/artifact/f8ba237c-35eb-49e6-83d0-b7abac825b61
- **User guide** (fills in as features ship): https://claude.ai/artifact/9LBhyAsX7Yx3wqPWHJCvdp

## Layout

This is a monorepo:

```
backend/   Fastify + Prisma + PostgreSQL API
web/       React frontend (coming next)
mobile/    React Native app (later)
```

## Status

- [x] Users, households, invite-code sharing, login/session auth
- [ ] Book catalog + barcode lookup
- [ ] Series completion tracking
- [ ] Wishlist / favorites
- [ ] Web frontend
- [ ] Native app

## Backend — local development

Requires Node 22+ and a PostgreSQL server.

```bash
cd backend
cp .env.example .env      # adjust DATABASE_URL if needed
npm install
npx prisma migrate dev
npm run dev                # starts the API on :3000
```

Run the test suite (needs the same database reachable via `DATABASE_URL`):

```bash
npm test
```

### Running everything with Docker

```bash
docker compose up -d db
cd backend && npx prisma migrate deploy && cd ..
docker compose up -d api
```

## Accounts

Registering without an `inviteCode` creates a new household and makes you its owner. To add a
second person to the *same* household (e.g. sharing with your partner), have them register with
the `inviteCode` from `GET /auth/me` (or the register/login response) — they join as a `member`
of the same household instead of creating their own.
