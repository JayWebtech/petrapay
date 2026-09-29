import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Vendored beUI components (https://beui.dev), kept as published upstream.
    "src/components/motion/**",
    "src/lib/hooks/**",
    "src/lib/ease.ts",
    "src/lib/presence-gate.tsx",
    "src/lib/text-shimmer.ts",
    "src/lib/touch.ts",
  ]),
]);

export default eslintConfig;
