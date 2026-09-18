# Kartu Stock Generator — Flagship Warehouse

Flagship web app to generate blank **Kartu Stock / Stock Cards** for warehouse pallet management. Pixel-perfect to the Google Sheets template (orange header, bordered grid).

![Flagship](https://img.shields.io/badge/Next.js-16-black) ![Tailwind](https://img.shields.io/badge/Tailwind-4-38bdf8) ![Prisma](https://img.shields.io/badge/Prisma-MySQL-2D3748) ![Vercel](https://img.shields.io/badge/Deploy-Vercel-black)

Demo: `npm run dev` → http://localhost:3000

---

## Features — flagship

- **Pixel-perfect Stock Card** — `Stock Card` orange header, 2×3 info grid (Pallet Code / Zone, SKU Name / Max Quota, Exp Date / QC Check), grey header row `DATE | Remark | QTY IN | QTY OUT | Stock Balance | PIC`, 8–20 blank rows, A4 print exact.
- **Live preview** + multi-card queue — edit per-card, see instantly.
- **Bulk generate** — paste pallet codes (one per line / comma), or CSV import (`palletCode,zone,skuName,maxQuota,expDate,qcCheck`). Export CSV.
- **QR Code** per pallet (qrcode.react).
- **Print → PDF** — browser print with `@page` A4, `print-color-adjust: exact`, each card on own page for bulk. Use **Print** or **PDF** (both trigger print dialog -> Save as PDF, 300 DPI).
- **Flagship UI** — dark warehouse theme, amber/orange, sticky generator, responsive.
- **Data persistence**:
  - **Local MySQL** via Prisma (`docker-compose.yml` → `mysql:8.0` on `3306`). Optional.
  - **Fallback** to `localStorage` — app works 100% without DB (Vercel default). If `DATABASE_URL` is set, syncs to MySQL via `/api/cards`.

## Stack

- Next.js 16 App Router, TypeScript, Tailwind CSS 4
- Prisma 5 + MySQL (`DATABASE_URL`)
- qrcode.react, next/font (Geist)

## Quick Start — Local MySQL

```bash
# 1. start MySQL
docker compose up -d

# 2. install
npm install

# 3. env
cp .env.example .env
# DATABASE_URL="mysql://kartustock:kartustock@localhost:3306/kartustock"

# 4. push schema & generate
npx prisma db push
npx prisma generate

# 5. dev
npm run dev

# 6. build (Webpack required on Windows due to SWC native binding issue)
npx next build --webpack
# or npm run build:win
```

## Vercel Deploy

1. Import your GitHub repo in Vercel.
2. **No DB needed** — leave `DATABASE_URL` empty, app uses `localStorage`.
3. **With DB** — add hosted MySQL URL (PlanetScale, Railway, TiDB Cloud) as `DATABASE_URL` env in Vercel → Redeploy → Prisma auto-migrates (run `npx prisma db push` locally against that URL once).
4. Build command: `next build` (Linux native bindings ok). On Windows local, use `next build --webpack`.

## Template Field Mapping

| UI Field | Sheet Cell |
|---|---|
| SKU Name | B9–D10 |
| Pallet Code | B7 |
| Zone / Area | E7 |
| Max Qty / Max Quota | E9 |
| Exp Date | B11–D13 |
| QC Check | E11–G13 |
| Table | DATE / Remark / QTY IN / QTY OUT / Stock Balance / PIC (12 rows default, adjustable) |

## Scripts

- `npm run dev` — dev server
- `npm run build` — build (Turbopack)
- `npm run build:win` — webpack build for Windows
- `npx prisma studio` — DB GUI

## License

Internal use — Warehouse DC.
