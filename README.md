# Daily Close

MVP v1 for replacing paper-sheet daily closing workflows in retail.

## What Works

- Simple login screen for demo access
- Owner dashboard with today’s sales, closed stores, missing cash, and missed-close warning
- Employee closing page with five clear steps
- Expo mobile app scaffold for iOS and Android
- Supabase production schema, RLS policies, seed data, and storage bucket setup
- Supabase Auth profile endpoint and protected API surfaces
- Mock POS report upload with loading state and auto-filled numbers
- Cash shortage calculation
- Multi-store demo data
- Prisma schema and NestJS API foundation
- PDF/Excel export foundation through the reports service

## Demo Data

- Owner: Sam Owner
- Stores: Store #1, Store #2, Store #3
- Employees: Maya and Chris
- Store #2 has not completed closing yet
- Store #3 has missing cash
- Several daily close records are included in the demo data file

## Install

```bash
npm install
```

## Run Web App

```bash
npm run dev:web
```

Open:

```text
http://127.0.0.1:3000
```

## Run API

```bash
npm run dev:api
```

The API runs on:

```text
http://127.0.0.1:4000
```

API docs:

```text
http://127.0.0.1:4000/docs
```

## Setup Database

Create a PostgreSQL database and add:

```bash
DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DATABASE"
```

Then run:

```bash
npm run prisma:generate
```

## Run Tests

```bash
npm test --workspace apps/api
```

## Run Mobile App

```bash
npm run dev:mobile
```

Then open with Expo Go or a development build.

## Type Check

```bash
npm run typecheck
```

## Build

```bash
npm run build
```

## Deploy To Vercel

From the project root:

```bash
npx vercel
```

For production:

```bash
npx vercel --prod
```

Use these settings if Vercel asks:

- Install command: `npm install`
- Build command: `npm run build --workspace apps/web`
- Output directory: `apps/web/.next`
- Framework: Next.js

## Production Setup

See:

```text
docs/production-runbook.md
```

Core production steps:

1. Create Supabase project.
2. Run `supabase/migrations/001_production_schema.sql`.
3. Create Supabase Auth users and link them to `public.users.auth_user_id`.
4. Run `supabase/seed.sql`.
5. Deploy the API with `DATABASE_URL`, `SUPABASE_URL`, and `SUPABASE_SERVICE_ROLE_KEY`.
6. Set `NEXT_PUBLIC_API_URL` and Supabase browser keys in Vercel.
7. Build iOS/Android with EAS from `apps/mobile`.

## Mocked For MVP Demo

- Login
- POS report reading
- File upload storage
- Owner dashboard data
- Notifications
- PDF/Excel file generation

## Still Needs Backend Connection

- A real Supabase project with Auth users linked to app users
- A deployed NestJS API URL
- Final app icon, splash screen, and store listing assets
- Real OCR provider
- Real email provider
- Real PDF and Excel files
