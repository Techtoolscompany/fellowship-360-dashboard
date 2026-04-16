# Fellowship 360 App

Fellowship 360 is a church operations platform built on Next.js. The repository contains the main web app, Grace AI workflows and tooling, automation and messaging infrastructure, and an Android SMS gateway companion app.

## Stack

- Next.js 16 App Router
- React 19
- TypeScript
- Drizzle ORM
- Inngest
- Vitest and Playwright

## Repository layout

- `src/app`: App Router pages, route handlers, and server actions
- `src/components`: UI and feature components
- `src/lib`: domain logic for Grace, automations, operations, billing, and integrations
- `src/db`: database schema and data access setup
- `src/content`: docs, blog, and policy content
- `apps/fellowship-sms-gateway-android`: Android SMS gateway companion app

## Getting started

1. Install dependencies:

```bash
pnpm install
```

2. Create local environment files from the example and fill in the required secrets:

```bash
cp .env.example .env.local
```

3. Start the local development stack:

```bash
pnpm dev
```

## Common commands

```bash
pnpm dev
pnpm lint
pnpm test
pnpm build
pnpm test:e2e
pnpm launch:preflight
pnpm status:delivery
```

## Notes

- The app uses MDX content and generates docs assets during install and build.
- The Android gateway project has its own Gradle workflow under `apps/fellowship-sms-gateway-android`.
- The current test suite includes unit, integration, and route coverage under `src/**/__tests__` plus Playwright smoke coverage in `e2e/`.
