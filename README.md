# PlyERP — Plywood & Building Materials Warehouse ERP

A complete single-device ERP for a small plywood / building-materials trading business.
No login, no cloud, no multi-user setup — opening the app goes straight to the dashboard.

Stack: **Next.js 16 (App Router) + PostgreSQL + Drizzle ORM + Tailwind CSS**.

---

## 1. Requirements

| Requirement | Version used |
|---|---|
| Node.js | 22.x (v22.22.1 verified) |
| PostgreSQL | 12+ |
| Disk space | ~200 MB for the app + database growth |

PostgreSQL command-line tools (`psql`, `pg_dump`) are **optional** — they enable the
full SQL database backup. Without them the app automatically falls back to a portable
JSON backup, which works everywhere.

---

## 2. Connect the database

The app reads the connection string from the `DATABASE_URL` environment variable.

### a. Create the database

```bash
createdb app_db
# or, with psql:
psql -U postgres -c "CREATE DATABASE app_db;"
```

### b. Set the connection string

Create a `.env` file in the project root:

```env
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/app_db
```

Format: `postgresql://USER:PASSWORD@HOST:PORT/DATABASE`

> **Important:** `drizzle.config.json` contains its own copy of the connection string and
> does **not** read from `.env`. If you change your username, password, host or database
> name, update **both** `.env` and `drizzle.config.json`, otherwise the schema tool will
> keep talking to the old database.

### c. Create the tables

```bash
npm install
npx drizzle-kit push
```

This creates every table defined in `src/db/schema.ts`. It is safe to re-run after
schema changes — it applies differences without destroying existing data.

### d. Verify the connection

```bash
npm run build && npm run start
# then open http://localhost:3000/api/health  → should return a healthy response
```

The first page load automatically seeds default data: business settings, 6 categories,
5 brands, 8 units with conversion rules (e.g. 1 Sheet = 32 sq.ft), a warehouse with
zones/racks/shelves, a chart of accounts, cash + bank accounts, 2 suppliers,
3 customers, and 8 sample plywood products with opening stock.

---

## 3. Launch the app

### Development (hot reload, for customising)

```bash
npm run dev
# http://localhost:3000
```

### Production (recommended for daily business use)

```bash
npm run build     # compile once (~10-20s)
npm run start     # start the server
# http://localhost:3000
```

Production mode is significantly faster and more stable than dev mode. Re-run
`npm run build` only after changing code.

### Custom port or LAN access

```bash
# different port
npm run start -- -p 5000

# allow other computers/tablets on the same network to use it
npm run start -- -H 0.0.0.0 -p 3000
# then browse to http://<this-computer-ip>:3000
```

### Keep it running / auto-start

- **Windows:** use Task Scheduler to run `npm run start` at logon, or install
  `pm2` (`npm i -g pm2` then `pm2 start npm --name plyerp -- start`).
- **Linux/macOS:** use `pm2`, or a systemd service unit.

For a shop computer, also consider a browser shortcut or kiosk shortcut to
`http://localhost:3000` so staff just click one icon.

---

## 4. Publishing / deployment options

Because this is a **single-device** ERP, "publishing" normally means installing it on the
shop computer rather than putting it on the internet.

### Option A — Run on the shop computer (recommended, matches the design)

1. Install Node.js 22 and PostgreSQL on that machine.
2. Copy the project folder (or `git clone`).
3. `npm install`
4. Set `.env` / `drizzle.config.json` to the local database.
5. `npx drizzle-kit push`
6. `npm run build`
7. `npm run start` and keep it running via pm2 / Task Scheduler.

Works fully offline — no internet is required for normal operation.

### Option B — Host it on a server / the internet

Any Node.js host works (VPS, Render, Railway, Fly.io, Azure App Service). You will need:

- A managed PostgreSQL database (Neon, Supabase, RDS, etc.) and its connection string in `DATABASE_URL`.
- Build command: `npm run build`
- Start command: `npm run start`

> Note: the app intentionally has **no authentication**. If you expose it to the
> internet, put it behind a VPN, an IP allow-list, or a reverse proxy with HTTP basic
> auth. Never publish it open to the world.

### Option C — Docker (optional)

```dockerfile
FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build
ENV NODE_ENV=production
EXPOSE 3000
CMD ["npm", "run", "start"]
```

Provide `DATABASE_URL` as an environment variable at runtime.

---

## 5. Backups (important for a single-device system)

Use **Backup & Restore** in the sidebar:

- **Backup Database Now** — full PostgreSQL dump (needs `pg_dump`); falls back to JSON.
- **Create Portable JSON Backup** — works on any machine, restorable from the UI.
- **Download** — save a copy to a USB drive or another folder.
- **Restore** — replaces all current data with the chosen backup (confirmation required).

Backups are written to `data/erp-backups` inside the project folder. Override the
location with the `ERP_BACKUP_DIR` environment variable:

```env
ERP_BACKUP_DIR=D:\PlyERP Backups
```

Recommended routine: back up at the end of every working day, and download a copy to
external media at least once a week.

---

## 6. Other commands

| Command | Purpose |
|---|---|
| `npm run dev` | Development server with hot reload |
| `npm run build` | Production build |
| `npm run start` | Start the production server |
| `npm run typecheck` | TypeScript check only |
| `npm run lint` | ESLint |
| `npx drizzle-kit push` | Apply schema changes to the database |

---

## 7. Modules

Dashboard · Inventory (products, categories, units, stock, movement, warehouses) ·
Purchasing (suppliers, POs, goods received, returns, payments) · Sales (customers,
quotations, sales orders, delivery notes, invoices, payments, returns) · Accounting
(expenses, income, bank & cash, ledger, trial balance) · Reports (inventory, sales,
purchases, profit, receivables, payables, VAT) · Settings · Backup & Restore

Every sale, purchase, payment, return and expense posts a balanced double-entry journal,
and all money is stored as `decimal(18,2)` — never floating point.

---

## 8. Known caveat

The SQL/JSON **backup and restore** code paths were implemented and reviewed but the
restore round-trip was not confirmed against a live server during development. Before
relying on it, test it once: create a backup, then restore it, and confirm your data
returns intact. If restore reports an error, your current data is left unchanged
(the whole restore runs inside one transaction that rolls back on failure).
