# Next.js + Prisma (Postgres) + Redis

A boilerplate with a typed backend: Postgres through Prisma 7, a read-through
Redis cache, validated environment variables, and example API routes.

## Stack

| Layer      | Choice                                        |
| ---------- | --------------------------------------------- |
| Framework  | Next.js 16 (App Router, TypeScript, Tailwind) |
| Database   | Postgres 17 via Prisma 7 + `@prisma/adapter-pg` |
| Cache      | Redis 7 via `ioredis`                         |
| Validation | Zod 4                                         |
| Local infra| Docker Compose                                |

## Getting started

```bash
cp .env.example .env      # already created for you
npm run db:up             # start Postgres + Redis
npm run db:migrate        # create the schema (name it e.g. "init")
npm run db:seed           # optional demo data
npm run dev
```

Open http://localhost:3000 — the home page shows live Postgres and Redis status.

No Docker? Point `DATABASE_URL` and `REDIS_URL` at any Postgres/Redis instance
(Neon, Supabase, RDS, Upstash, Elasticache…) and skip `db:up`.

## Environment

`src/lib/env.ts` parses `process.env` with Zod at import time, so a missing or
malformed variable fails loudly at startup instead of at the first query.

| Variable            | Required | Description                          |
| ------------------- | -------- | ------------------------------------ |
| `DATABASE_URL`      | yes      | Postgres connection string           |
| `REDIS_URL`         | yes      | Redis connection string              |
| `CACHE_TTL_SECONDS` | no (60)  | Default TTL for the cache helper     |

## Project layout

```
prisma/
  schema.prisma        # User + Post models
  seed.ts              # demo data, run via npm run db:seed
prisma.config.ts       # Prisma 7 CLI config (schema path, datasource, seed)
src/lib/
  env.ts               # Zod-validated environment
  prisma.ts            # PrismaClient singleton (HMR-safe) + pg driver adapter
  redis.ts             # ioredis singleton (HMR-safe)
  cache.ts             # cached() / invalidate() / invalidatePattern()
src/app/api/
  health/route.ts      # GET  — pings Postgres and Redis
  users/route.ts       # GET (cached) / POST (create + invalidate)
  users/[id]/route.ts  # GET (cached) / DELETE (+ invalidate)
```

## Caching

`cached(key, fetcher, { ttl })` returns the Redis value when present, otherwise
runs the fetcher and stores the JSON result. Two deliberate behaviours:

- **Redis failures are non-fatal.** A cache read or write error is logged and
  the request falls through to Postgres, so a cache outage costs latency, not
  availability.
- **Empty results are not cached.** A `null` never occupies a key for a full
  TTL, so a freshly created row is visible immediately.

Invalidate with `invalidate("users:abc")` for exact keys or
`invalidatePattern("users:*")` for a prefix — the latter uses `SCAN`, never
`KEYS`, so it does not block the Redis event loop.

```ts
import { cacheKeys, cached, invalidatePattern } from "@/lib/cache";

const users = await cached(cacheKeys.users(), () => prisma.user.findMany());
await invalidatePattern("users:*");
```

## Try the API

```bash
curl localhost:3000/api/health
curl localhost:3000/api/users                       # cold: hits Postgres
curl localhost:3000/api/users                       # warm: served from Redis
curl -X POST localhost:3000/api/users \
  -H 'content-type: application/json' \
  -d '{"email":"grace@example.com","name":"Grace Hopper"}'
```

## Scripts

| Script                | Does                                        |
| --------------------- | ------------------------------------------- |
| `npm run dev`         | Next dev server                             |
| `npm run build`       | `prisma generate` then `next build`         |
| `npm run db:up/down`  | Start / stop Postgres + Redis in Docker     |
| `npm run db:migrate`  | Create and apply a migration (development)  |
| `npm run db:deploy`   | Apply pending migrations (production)       |
| `npm run db:push`     | Push schema without a migration (prototyping) |
| `npm run db:seed`     | Run `prisma/seed.ts`                        |
| `npm run db:studio`   | Prisma Studio                               |
| `npm run db:reset`    | Drop, re-migrate and re-seed                |

## Notes on Prisma 7

- The connection URL no longer lives in `schema.prisma`. The CLI reads it from
  `prisma.config.ts`; the runtime gets it from the `PrismaPg` driver adapter in
  `src/lib/prisma.ts`.
- `prisma.config.ts` imports `dotenv/config` because the CLI no longer loads
  `.env` on its own.

## Deploying

Set `DATABASE_URL` and `REDIS_URL` in the host's environment, run
`npm run db:deploy` as a release step, then `npm run build`. In serverless
environments prefer a pooled Postgres endpoint (PgBouncer, Neon pooler,
Prisma Accelerate) and a Redis provider that accepts many short-lived
connections.
