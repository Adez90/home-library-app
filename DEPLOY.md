# Deploying to your own server

This assumes a Linux server you can SSH into, with a domain (or subdomain, e.g.
`library.yourdomain.com`) already pointed at its IP address.

## 1. Prerequisites on the server

```bash
# Docker + Compose plugin (Debian/Ubuntu)
curl -fsSL https://get.docker.com | sh
sudo apt install docker-compose-plugin

# nginx + certbot, for TLS in front of the app
sudo apt install nginx certbot python3-certbot-nginx
```

## 2. Get the code onto the server

```bash
git clone https://github.com/Adez90/home-library-app
cd home-library-app
```

## 3. Configure secrets

```bash
cp .env.example .env
openssl rand -hex 32   # run this three times, once for each value below
$EDITOR .env
```

Fill in `POSTGRES_PASSWORD` and `JWT_SECRET` with random values you generated — `docker compose`
refuses to start without them (no insecure default in production). Also set
`REGISTRATION_SECRET` — without it, anyone who finds your domain can register and create their
own household on your server. Once it's set, only someone who knows that value can start a *new*
household; your wife joining *yours* still only needs the invite code from step 6, never this.

`SENTRY_DSN` / `VITE_SENTRY_DSN` and `LOG_LEVEL` are optional — see
[Error tracking](#error-tracking-optional) below. Leave them blank for now if you just want to
get the app running; you can add them and re-run `docker compose up -d --build` any time later.

## 4. Build and start the app

```bash
docker compose up -d --build
```

This starts three containers: `db` (Postgres, data persisted in a Docker volume), `api`
(the backend, which also runs pending database migrations on startup), and `web` (nginx
serving the built frontend and proxying `/api/*` to `api`). `web` listens on `127.0.0.1:8080`
only — it isn't reachable from the internet yet, which is what the next step is for.

Check it's healthy:

```bash
docker compose ps
curl -s http://localhost:8080/api/health   # should print {"status":"ok"}
```

## 5. Put TLS in front of it

Create `/etc/nginx/sites-available/library`:

```nginx
server {
    listen 80;
    server_name library.yourdomain.com;

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/library /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

# Gets a certificate and rewrites the config above to redirect HTTP -> HTTPS automatically
sudo certbot --nginx -d library.yourdomain.com
```

Visit `https://library.yourdomain.com` — you should see the login screen.

## 6. First-time setup

1. Register the first account. Leave the invite code blank — this creates your household and
   makes you its owner. If you set `REGISTRATION_SECRET` in step 3, enter it in the
   "Registration code" field (only shown when you're not using an invite code).
2. Open your account (the register/login response, or a future "household settings" screen)
   to get the invite code.
3. Have your wife register with that invite code — she joins your household instead of
   creating her own, so you both see and edit the same library under separate logins. She does
   *not* need the registration code from step 1 for this.

The app is in English by default; either of you can switch to Swedish with the EN/SV switcher
in the header (or on the login/register screen) — the choice is remembered per browser.

## Updating later

```bash
cd home-library-app
git pull
docker compose up -d --build
```

Database migrations run automatically on `api` container startup — nothing extra to do.

## Backups

The database lives in the `db-data` Docker volume. A simple periodic backup:

```bash
docker compose exec db pg_dump -U library library > backup-$(date +%F).sql
```

Copy that file off the server (e.g. to your own machine or object storage) regularly — a
cron job calling a small script that runs the command above and rotates old backups is enough
for a personal deployment like this.

## Logs / troubleshooting

```bash
docker compose logs -f api      # backend logs — one JSON line per request/error
docker compose logs -f web      # nginx access/error logs
docker compose ps               # container status
```

The backend logs every request (method, path, status code, response time) and every error with
its full stack trace, as one JSON object per line — pipe through `jq` for readability, e.g.
`docker compose logs -f api | jq .`. Verbosity is controlled by `LOG_LEVEL` in `.env` (`info` by
default; `debug` shows more, including which ISBN metadata provider was tried and why it fell
through to the next one).

## Error tracking (optional)

Set `SENTRY_DSN` (backend) and/or `VITE_SENTRY_DSN` (web app) in `.env` to send unhandled
errors to a [Sentry](https://sentry.io) project instead of only your server's local logs — useful
once you're not the one who'll notice something's broken. Both are independent and both optional;
leave either blank to skip it, nothing else about the app changes.

1. In Sentry, create a project for the backend (platform: Node/Fastify — or just Node) and copy
   its DSN into `SENTRY_DSN`. Create a second project for the web app (platform: React) and copy
   its DSN into `VITE_SENTRY_DSN` — the frontend one is baked into the built JS at build time, so
   it needs `--build` to take effect, not just a restart.
2. `docker compose up -d --build`.

That's it — no code changes needed either way.
