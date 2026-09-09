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
    // `.next/**` only matches the one at the repo root. Agent worktrees under
    // .claude/ carry their own build output, and linting those minified chunks
    // exhausts the V8 heap and kills `npm run lint` outright.
    "**/.next/**",
    ".claude/**",
  ]),
]);

export default eslintConfig;
