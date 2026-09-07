import { prisma } from "@/lib/prisma";
import { redis } from "@/lib/redis";

// Status is read live on every request rather than at build time.
export const dynamic = "force-dynamic";

type ServiceStatus = {
  name: string;
  ok: boolean;
  detail: string;
};

async function postgresStatus(): Promise<ServiceStatus> {
  try {
    const [users, posts] = await Promise.all([
      prisma.user.count(),
      prisma.post.count(),
    ]);
    return {
      name: "Postgres (Prisma)",
      ok: true,
      detail: `${users} user${users === 1 ? "" : "s"}, ${posts} post${posts === 1 ? "" : "s"}`,
    };
  } catch (err) {
    return {
      name: "Postgres (Prisma)",
      ok: false,
      detail: err instanceof Error ? err.message : String(err),
    };
  }
}

async function redisStatus(): Promise<ServiceStatus> {
  try {
    const startedAt = Date.now();
    await redis.ping();
    const keys = await redis.dbsize();
    return {
      name: "Redis (ioredis)",
      ok: true,
      detail: `PONG in ${Date.now() - startedAt}ms, ${keys} key${keys === 1 ? "" : "s"}`,
    };
  } catch (err) {
    return {
      name: "Redis (ioredis)",
      ok: false,
      detail: err instanceof Error ? err.message : String(err),
    };
  }
}

const endpoints = [
  { method: "GET", path: "/api/health", note: "Liveness probe for both services" },
  { method: "GET", path: "/api/users", note: "Cached list (read-through, TTL)" },
  { method: "POST", path: "/api/users", note: "Create + invalidate users:*" },
  { method: "GET", path: "/api/users/[id]", note: "Cached single user with posts" },
  { method: "DELETE", path: "/api/users/[id]", note: "Delete + invalidate" },
];

export default async function Home() {
  const services = await Promise.all([postgresStatus(), redisStatus()]);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-10 px-6 py-16">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight">
          Next.js + Prisma + Redis
        </h1>
        <p className="text-sm opacity-70">
          Postgres through Prisma, a read-through Redis cache, and typed API
          routes. Run <code className="font-mono">npm run db:up</code> to start
          both services.
        </p>
      </header>

      <section className="flex flex-col gap-3">
        <h2 className="text-xs font-medium uppercase tracking-widest opacity-50">
          Services
        </h2>
        <ul className="flex flex-col gap-3">
          {services.map((service) => (
            <li
              key={service.name}
              className="flex items-start gap-3 rounded-lg border border-black/10 p-4 dark:border-white/15"
            >
              <span
                aria-hidden
                className={`mt-1.5 size-2 shrink-0 rounded-full ${
                  service.ok ? "bg-emerald-500" : "bg-red-500"
                }`}
              />
              <div className="flex min-w-0 flex-col gap-1">
                <span className="font-medium">{service.name}</span>
                <span className="break-words font-mono text-xs opacity-60">
                  {service.detail}
                </span>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-xs font-medium uppercase tracking-widest opacity-50">
          API routes
        </h2>
        <ul className="divide-y divide-black/10 overflow-hidden rounded-lg border border-black/10 dark:divide-white/15 dark:border-white/15">
          {endpoints.map((endpoint) => (
            <li
              key={`${endpoint.method} ${endpoint.path}`}
              className="flex flex-wrap items-baseline gap-x-3 gap-y-1 p-3 text-sm"
            >
              <span className="w-16 shrink-0 font-mono text-xs opacity-60">
                {endpoint.method}
              </span>
              <span className="font-mono">{endpoint.path}</span>
              <span className="ml-auto text-xs opacity-50">{endpoint.note}</span>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
