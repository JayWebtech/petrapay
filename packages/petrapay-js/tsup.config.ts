import { defineConfig } from "tsup";

export default defineConfig([
  {
    entry: { index: "src/index.ts" },
    format: ["esm", "cjs"],
    dts: true,
    clean: true,
    target: "es2020",
  },
  {
    entry: { react: "src/react.tsx" },
    format: ["esm", "cjs"],
    dts: true,
    target: "es2020",
    external: ["react", "react/jsx-runtime"],
    // Next.js App Router needs the directive at the top of the built file.
    banner: { js: '"use client";' },
  },
  {
    entry: { "petrapay.global": "src/global.ts" },
    format: ["iife"],
    minify: true,
    target: "es2018",
    outExtension: () => ({ js: ".js" }),
  },
]);
