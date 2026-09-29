import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // `prisma generate` (run on install) never connects, so it must work without a database,
    // e.g. when a monorepo install runs on a host that only builds the web app.
    // Migrations and the API itself still read the real DATABASE_URL.
    url: process.env.DATABASE_URL ?? "postgresql://localhost:5432/unset",
  },
});
