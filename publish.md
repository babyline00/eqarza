# E-Qarza — Publish / Hosting Guide

Production-ready deployment guide for the E-Qarza loan app (Next.js 16 standalone build, Prisma + SQLite, OTP delivery via matrixsender.com SMS + WhatsApp, admin dashboard).

---

## 1. Requirements

| Item | Version / note |
|---|---|
| Node.js | **20+** (tested on 24) |
| Operating system | Linux VPS (Ubuntu 22.04+ recommended) |
| RAM / disk | 1 GB+ RAM, ~500 MB free disk |
| Port | 3000 (default) |
| Outbound HTTPS | required for SMS gateways |

---

## 2. Environment variables (`.env`)

`.env` is **not** version-controlled (gitignored). Create it on the host from `.env.example`.

| Variable | Meaning | Default / example |
|---|---|---|
| `DATABASE_URL` | SQLite file URL | dev: `file:./db/custom.db`<br>host: `file:/opt/pakloan/data/custom.db` (absolute path — see §4) |
| `DEMO_MODE` | `"true"` = OTP returned inline, SMS **never** called; `"false"` = real SMS | `"true"` |
| `OTP_COOLDOWN_SECONDS` | Cooldown before a NEW OTP is minted; resends reuse the same code during the window | `10` |
| `NEXTAUTH_SECRET` | Random secret | change from default |
| `NEXTAUTH_URL` | Public base URL of the app | `https://eqarza.example.com` |
| `ADMIN_PATH` | Admin panel path. Custom value (e.g. `/eqarza-admin`) moves the admin page there; `/admin` then redirects to it | `/admin` |
| `MATRIXSENDER_SECRET` | matrixsender API secret | *
| `MATRIXSENDER_ENDPOINT` | matrixsender SMS endpoint | `https://matrixsender.com/api/send/sms` |
| `MATRIXSENDER_CHANNEL` | OTP delivery channel | `sms` (`whatsapp` / `both`) |
| `MATRIXSENDER_ACCOUNT` | MatrixSender WhatsApp account (needed for WhatsApp channel) | `+923001234567` |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` | Used by the seed to create/login the admin (see §6) | `admin` / `admin123` |

> **IMPORTANT:** `next build` copies `.env` into the standalone folder. On the host, **replace or delete it** so the build-time values (which may include a live matrixsender key) are not shipped / reused.

---

## 3. Build

```bash
npm ci                 # clean install of all deps (build + prisma CLI needed)
npm run db:push        # create/update schema on the local dev DB
npm run build          # next build + copy static/public into standalone
```

The production artifact is **`.next/standalone/`** (self-contained Node server: `server.js`, `node_modules`, `public`).

---

## 4. Deploy to a VPS (Ubuntu)

Recommended layout (keep data OUTSIDE the app dir so redeploys never wipe it):

```
/opt/pakloan/
├── app/        # the project (or just .next/standalone contents)
├── data/       # custom.db lives here
└── uploads/    # user-uploaded KYC/proof images
```

### Option A — full project (simplest, recommended)

```bash
# 1. upload the project (exclude .next, node_modules, prisma/db, .env)
rsync -av --exclude '.next' --exclude 'node_modules' --exclude 'prisma/db' \
      --exclude '.env' ./ user@HOST:/opt/pakloan/app

# 2. on the host
cd /opt/pakloan/app
npm ci

# 3. env: point DATABASE_URL at the persistent data dir
sed -i 's|file:./db/custom.db|file:/opt/pakloan/data/custom.db|' .env   # or edit .env

# 4. create the DB schema in the data dir
mkdir -p /opt/pakloan/data
npm run db:push

# 5. build + seed admin
npm run build
npm run db:seed          # creates admin (see §6)

# 6. uploads dir (persistent, outside the app)
mkdir -p /opt/pakloan/uploads
ln -s /opt/pakloan/uploads public/uploads
```

Start once to verify:

```bash
NODE_ENV=production node .next/standalone/server.js   # should listen on :3000
```

### Option B — standalone bundle only

```bash
# 1. from build machine, upload the standalone dir
rsync -av .next/standalone/ user@HOST:/opt/pakloan/app/

# 2. preparation must happen BEFORE deploying (standalone does NOT include
#    the prisma CLI), so either:
#    - run `npm run db:push` in a build dir on the host, or
#    - ship a pre-created custom.db into /opt/pakloan/data
mkdir -p /opt/pakloan/data /opt/pakloan/uploads
ln -s /opt/pakloan/uploads /opt/pakloan/app/public/uploads

# 3. .env with the ABSOLUTE DATABASE_URL
```

---

## 5. Process manager (systemd)

`/etc/systemd/system/eqarza.service`:

```ini
[Unit]
Description=E-Qarza Loan App
After=network.target

[Service]
Type=simple
User=pakloan
WorkingDirectory=/opt/pakloan/app
Environment=NODE_ENV=production
EnvironmentFile=/opt/pakloan/app/.env
ExecStart=/usr/bin/node /opt/pakloan/app/.next/standalone/server.js
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now eqarza
sudo systemctl status eqarza
```

### nginx reverse proxy (optional, for HTTPS/domain)

```nginx
server {
    listen 80;
    server_name eqarza.example.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        client_max_body_size 20m;   # CNIC/selfie uploads
    }
}
```

Then `sudo certbot --nginx -d eqarza.example.com` for HTTPS. Set `NEXTAUTH_URL` to the HTTPS URL.

---

## 6. First-run checklist

1. **Admin account** — `npm run db:seed` creates `admin` / `admin123` (override with `ADMIN_USERNAME`/`ADMIN_PASSWORD` before seeding). Existing admin is left untouched. **Change the password immediately** by re-seeding with a strong `ADMIN_PASSWORD` then deleting the old row, or via the DB.
2. Visit `https://YOUR-HOST${'$'}{ADMIN_PATH:-/admin}` (default `/admin`, or the custom path in `ADMIN_PATH`) and log in.
3. Add **deposit accounts** (JazzCash / EasyPaisa / Bank) in the admin dashboard.
4. **OTP / SMS**: with `DEMO_MODE="false"`, OTP is delivered via matrixsender per the configured channel (SMS / WhatsApp / both). If delivery fails, the API returns a 502 with the provider reason. Fall back to `DEMO_MODE="true"` to show the code inline to users.
5. Test login + KYC upload end-to-end.

---

## 7. Updating the app

```bash
rsync -av --exclude '.next' --exclude 'node_modules' --exclude 'prisma/db' --exclude '.env' \
      ./ user@HOST:/opt/pakloan/app
ssh user@HOST
cd /opt/pakloan/app
npm ci
npm run db:push      # apply any schema changes
npm run build
sudo systemctl restart eqarza
```

User data (DB + uploads) live in `/opt/pakloan/data` and `/opt/pakloan/uploads`, so redeploys never lose them.

---

## 8. Data & backup

| What | Where |
|---|---|
| SQLite database | `/opt/pakloan/data/custom.db` |
| Uploaded images | `/opt/pakloan/uploads/` (symlinked to `public/uploads`) |
| Runtime logs | `journalctl -u eqarza` |

Backup both directories regularly (e.g. `rsync` to another machine, or a cron job).

---

## 9. Known issues / notes

- **SMS/WhatsApp delivery**: matrixsender `GET /api/send/sms` requires `mode` + a valid `gateway` (credits) or `device` (devices); WhatsApp `GET /api/send/whatsapp` requires a linked `account`. Wrong values return `Device doesn't exist!` / `WhatsApp account doesn't exist!`. The API key also needs the right permissions (e.g. `get_wa_accounts`) for the read endpoints. Configure these in admin → Settings → API / SMS Gateways and use **Send Test SMS**. Until a gateway works, keep `DEMO_MODE="true"` so users can still log in.
- **Auth strength**: admin password is stored as unsalted SHA-256 (demo-grade). Always run behind HTTPS and change the admin password.
- **`allowedDevOrigins`** in `next.config.ts` only affects dev mode; production is unaffected.
- **Uploads** are written relative to the process working directory — that is why the deploy layout symlinks `public/uploads` to `/opt/pakloan/uploads`.
- **SQLite single-node**: this schema is SQLite; it is not designed for horizontal scaling. For a bigger rollout, migrate to PostgreSQL (`DATABASE_URL` is the only change needed — see commented example in `.env`).