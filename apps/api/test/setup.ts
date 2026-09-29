// Point the API at a separate database before any app module reads the environment.
import { execSync } from "node:child_process";

const base = process.env.DATABASE_URL ?? "postgresql://petrapay:petrapay@localhost:5433/petrapay";
const url = process.env.TEST_DATABASE_URL ?? base.replace(/\/([^/?]+)(\?|$)/, "/$1_test$2");
process.env.DATABASE_URL = url;
process.env.WORKER_ENABLED = "false";
process.env.LOG_LEVEL = "silent";

execSync("npx prisma migrate deploy", { env: { ...process.env, DATABASE_URL: url }, stdio: "ignore" });
