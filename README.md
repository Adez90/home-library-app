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
- [x] Multi-language editions (e.g. an English and a Swedish copy of the same book) tracked
      separately, with series completion counted once per volume regardless of language
- [x] Manual-entry deduplication (two "identical" hand-entered books reuse one catalog row)
- [x] Separate dev/prod environments (`docker-compose.yml` vs `docker-compose.dev.yml`)
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

### Docker: dev vs. prod

Two separate compose files, on purpose — dev never touches prod data, even run side by side
on the same machine:

```bash
# Local development — hot-reload, its own dev database on :5433, no secrets required
docker compose -f docker-compose.dev.yml up

# Production — see DEPLOY.md for the full walkthrough (domain, TLS, systemd)
cp .env.example .env && $EDITOR .env    # set POSTGRES_PASSWORD and JWT_SECRET
docker compose up -d --build
```

The `web` service serves the built frontend via nginx on `:8080` and proxies `/api/*` to the
`api` service. Put your own TLS-terminating reverse proxy (nginx + Let's Encrypt on your domain)
in front of port 8080 for production — see **[DEPLOY.md](./DEPLOY.md)** for step-by-step
instructions on your own server.

## Accounts

Registering without an `inviteCode` creates a new household and makes you its owner. To add a
second person to the *same* household (e.g. sharing with your partner), have them register with
the `inviteCode` from `GET /auth/me` (or the register/login response) — they join as a `member`
of the same household instead of creating their own.

## Multiple languages

Owning the same title in more than one language (e.g. Sarah J. Maas in both English and
Swedish) is fully supported — each language edition is its own catalog row (own ISBN, own
cover), shown with a small language badge. A series' "X of Y owned" count is per **volume**,
not per edition: owning Book 1 in both English and Swedish still counts as one volume owned.
The series page's language filter lets you drill into "how much of this series do I have in
Swedish specifically."

Dragon Ball vs. Dragon Ball Z, or any other same-franchise-different-series situation, needs no
special handling — they're just two different series names, kept apart automatically.

## Known limitations

- Manual-entry dedup (title + author + series + volume + language, exact match) prevents the
  obvious duplicate case, but isn't fuzzy — "The Ember Road" and "the ember road " (trailing
  space) won't be caught by a typo-level mismatch. ISBN-based adds don't have this problem at
  all, since the ISBN itself is the dedup key.
- Series pages only know about volumes someone has looked up or added; there's no external
  "this series has 7 books" source yet (planned: Wikidata).
- Open Library / Google Books lookups are unit-tested against fixtures, not live network calls,
  to keep CI fast and deterministic.
