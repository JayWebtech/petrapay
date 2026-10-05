import { z } from "zod";

const bool = z
  .string()
  .optional()
  .transform((v) => v === "true" || v === "1");

const schema = z
  .object({
    DATABASE_URL: z.string().min(1),
    PORT: z.coerce.number().default(4000),
    APP_ORIGIN: z.string().url().default("http://localhost:3000"),
    COOKIE_SECURE: bool,
    ONECLICK_BASE_URL: z.string().url().default("https://1click.chaindefuser.com"),
    ONECLICK_JWT: z.string().optional().default(""),
    ONECLICK_CONFIDENTIALITY: z.enum(["public", "basic", "advanced"]).default("public"),
    ONECLICK_REFERRAL: z.string().default("petrapay"),
    SLIPPAGE_BPS: z.coerce.number().int().min(0).max(1000).default(100),
    APP_FEE_BPS: z.coerce.number().int().min(0).max(400).default(0),
    APP_FEE_RECIPIENT: z.string().optional().default(""),
    WORKER_ENABLED: z
      .string()
      .optional()
      .transform((v) => v !== "false"),
    POLL_INTERVAL_MS: z.coerce.number().int().min(2000).default(8000),
    /**
     * Let webhook URLs use plain http and point at private/loopback addresses. Off unless set, so a
     * merchant-supplied URL can never reach into the server's own network; turn it on for local testing.
     */
    WEBHOOK_ALLOW_PRIVATE: bool,
  })
  .superRefine((env, ctx) => {
    if (env.ONECLICK_CONFIDENTIALITY !== "public" && !env.ONECLICK_JWT) {
      ctx.addIssue({ code: "custom", path: ["ONECLICK_JWT"], message: "Confidential quotes require a 1Click partner JWT" });
    }
    if (env.APP_FEE_BPS > 0 && !env.APP_FEE_RECIPIENT) {
      ctx.addIssue({ code: "custom", path: ["APP_FEE_RECIPIENT"], message: "Set a fee recipient when APP_FEE_BPS > 0" });
    }
  });

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error("Invalid environment:\n" + z.prettifyError(parsed.error));
  process.exit(1);
}

export const env = parsed.data;
