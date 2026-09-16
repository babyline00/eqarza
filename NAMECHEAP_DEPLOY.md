# E-Qarza — Namecheap cPanel Deployment Guide

Step-by-step guide for installing the **standalone publish bundle** on a
**Namecheap shared cPanel + LiteSpeed** account (domain `eqarza.online`, cPanel
user `musaddiqa00`). Uses the **cPanel "Setup Node.js App"** panel — no
systemd, no nginx config editing, no SSH required (File Manager is enough).

---

## 1. Did you see `Error: Cannot find module 'next'`?

That error means the Node.js app started but **`node_modules` did not make it
to the server** (or the extract was incomplete). The bundle **does** contain it
(`node_modules/next` is included), so this is almost always an upload problem:

- cPanel File Manager drag-and-drop commonly **skips or stalls** on large
  folders like `node_modules` (tens of thousands of files).
- The zip has ~1,700 entries; if your File Manager shows `app/node_modules`
  missing or a much smaller file count, the upload was partial.

**Do not** drag-and-drop the folder. Upload the **zip** and extract it on the
server (see §3) — that is reliable.

---

## 2. What you got

```
pakloan-publish.zip                       (single archive; about 116 MB)
├── app/                the runnable server — server.js + .next + node_modules + public
├── data/custom.db      fresh database, admin account already created
├── uploads/            empty folder for proof images
├── deploy/             (VPS files — NOT needed for cPanel)
├── .env.example        environment template with comments
├── publish.md          full VPS guide (alternate route)
└── NAMECHEAP_DEPLOY.md this guide
```

The app folder is a **self-contained Node server**: you only need Node.js to run
it. cPanel already provides Node.js (yours is Node v24 — great, requires 20+).

---

## 3. Install (File Manager — recommended)

1. Log in to **cPanel** → **File Manager**. Click **Settings** (top-right) and
   tick **Show Hidden Files** (so you can see `.next`, `.env`, `.htaccess`).
2. Open your domain's folder:
   `/home/musaddiqa00/eqarza.online/`
3. Click **Upload** and upload `pakloan-publish.zip` into that folder. Wait for
   the green "uploaded" bar to finish — do **not** close the window early.
4. Right-click the zip → **Extract**. This creates a folder named
   `pakloan-publish/` full of `app/`, `data/`, `uploads/`, `deploy/`, docs.
5. **Verify the upload is complete before continuing.** Extract must show:
   - `pakloan-publish/app/node_modules/next/package.json`  ← the thing that errored
   - `pakloan-publish/app/server.js`
   - `pakloan-publish/app/.next/` (hidden folder)
   If `node_modules` is incomplete, delete the folder and go back to step 4
   (or re-upload the zip — the transfer was cut short).

### Move it into place

The recommended layout (keep the database OUTSIDE `app/` so re-deploys never
wipe it — matches the bundle's paths):

```
/home/musaddiqa00/eqarza.online/
├── app/                  <- the server (from pakloan-publish/app)
├── data/                 <- custom.db (from pakloan-publish/data)
└── uploads/              <- from pakloan-publish/uploads (optional)
```

With File Manager: **move** `app/` and `data/` from `pakloan-publish/` to
`eqarza.online/`. You may keep or delete the `deploy/`, `.env.example`,
`publish.md`, `NAMECHEAP_DEPLOY.md` folders (they are only documentation).

> If `app/` is already at `/home/musaddiqa00/eqarza.online/app` (that's what the
> error log showed), keep it there — just make sure `node_modules` is present.

---

## 4. Create the Node.js app (cPanel)

1. In cPanel, open **Setup Node.js App** (under *Software*).
2. Click **Create Application** and fill in:

   | Field | Value |
   |---|---|
   | Node.js version | any **20 or later** (you have 24 — keep it) |
   | Application root | `/home/musaddiqa00/eqarza.online/app` |
   | Application URL | `https://eqarza.online` |
   | Application startup file | `server.js` |
   | Application name | `eqarza` |
   | Startup file environment | leave default |

3. Click **Create**. cPanel shows the app and assigns a port (e.g. `3000`).
   Keep that page — you'll set environment variables next.

### Set the environment variables (critical)

Still on the app's page, find **Environment variables** and add:

| Variable | Value |
|---|---|
| `DATABASE_URL` | `file:/home/musaddiqa00/eqarza.online/data/custom.db` |
| `NEXTAUTH_URL` | `https://eqarza.online` |
| `NEXTAUTH_SECRET` | a long random string (e.g. from a password generator) |
| `DEMO_MODE` | `true` (see §6 about real SMS) |
| `OTP_COOLDOWN_SECONDS` | `10` |

The standalone server reads these from the app environment. **Do not** point
`DATABASE_URL` at a relative path — use the absolute `/home/...` path above so
the SQLite file is the bundled `data/custom.db`. If you leave the URL blank or
relative it will try to open a `.db` inside `app/` and fail with
"database file does not exist".

> `ADMIN_PATH` is baked in at build time (default `/admin`; the bundle was built
> with the default). To use a custom path, a rebuild from the full project with
> `ADMIN_PATH` set is required.

### Make the uploads folder writable

1. File Manager → go to `/home/musaddiqa00/eqarza.online/app/public/`.
2. Right-click → **Create New Folder** → name it `uploads`.
3. Right-click `uploads` → **Change Permissions** → `755` (or 775).
   The app runs as your cPanel user, so this folder is where KYC/proof images
   are written.

### Start the app

Back in **Setup Node.js App**, click **Stop**, then **Start** (or **Restart**).
Then open `https://eqarza.online` (allow ~30 seconds for the first request).

---

## 5. First login checklist

1. Go to `https://eqarza.online/admin` and log in with:
   **user `admin` / password `admin123`**.
2. **Immediately change the password**: admin → **Settings** tab → *Admin
   Password* → enter current + new password → **Update Password**. (You stay
   logged in; your old generated code is invalidated.)
3. Add deposit accounts (JazzCash / EasyPaisa / Bank) in the admin dashboard.
4. Optional: enable the Tawk.to chat widget in admin → **Settings**.
5. Test a full login (OTP) and a KYC image upload to confirm `uploads/` works.

---

## 6. Turn on real SMS (when ready)

- `DEMO_MODE="true"` (default) returns the OTP code **inline in the app** for
  testing and never calls the SMS gateways.
- To send real OTP messages, set `DEMO_MODE="false"` and add the gateway vars
  from `.env.example`: `MATRIXSENDER_SECRET`, `MATRIXSENDER_ENDPOINT`,
  `MATRIXSENDER_CHANNEL`, `MATRIXSENDER_ACCOUNT` (+ `MATRIXSENDER_MODE`,
  `MATRIXSENDER_GATEWAY`/`MATRIXSENDER_DEVICE` for SMS). You can also configure
  everything in **admin → Settings → API / SMS Gateways** (DB values override
  env) and verify with **Send Test SMS**. Delivery is still in testing (see
  `publish.md` §9) — keep `DEMO_MODE="true"` until it's confirmed, or users
  can't log in.

---

## 7. Updating the app later

The bundle is a snapshot. To update the code:

- **Easiest**: ask for a new zip and repeat §3 (upload → extract → move `app/`).
  Only replace `app/`; keep `data/` (your users/database) untouched. Then
  **Stop → Start** the Node.js app in cPanel.
- If anything ever gets deleted again, the app root must always contain
  `node_modules` — never upload `app/` by dragging individual files.

---

## 8. Troubleshooting

| Error | Cause | Fix |
|---|---|---|
| `Cannot find module 'next'` | `node_modules` missing/incomplete on server | Re-upload the **zip**, extract (§3 step 5), restart the app |
| `file:...custom.db does not exist` | `DATABASE_URL` wrong/relative | Set absolute path `file:/home/musaddiqa00/eqarza.online/data/custom.db` in cPanel env vars |
| Blank page / 404 after login | App root or startup file wrong in cPanel | Check app root = `.../eqarza.online/app`, startup file = `server.js` |
| Image upload fails (500) | `public/uploads` missing/not writable | Create `uploads` under `app/public/`, chmod 755 |
| "Port already in use" | old app instance running | In Setup Node.js App, Stop → Start the app |
| Site very slow first load | Serverless/Node cold start | Normal in dev-tier cPanel; next requests are fast |

> The cPanel "Setup Node.js App" page shows a **port** number for your app; the
> LiteSpeed proxy forwards your URL to it automatically — you don't need to
> change anything. If the error log you saw comes from `/usr/local/lsws/fcgi-bin/lsnode.js`,
> that is normal — that's the LiteSpeed node runner, and its error message is simply
> the output of your `server.js` failing to load `next`.