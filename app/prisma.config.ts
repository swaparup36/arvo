import "dotenv/config";

import { defineConfig, env } from "prisma/config";

// Prisma 7 reads CLI configuration from here rather than from schema.prisma.
export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: env("DATABASE_URL"),
  },
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
});
