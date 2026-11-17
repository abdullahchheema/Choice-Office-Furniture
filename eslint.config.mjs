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
    // Pre-migration static site, kept verbatim as the visual reference for
    // Phase 2 and deleted in Phase 7. Linting it would mean "fixing" the very
    // code we are diffing against. Removed along with the folder.
    "legacy/**",
    // Browser-injected dev tool, not part of the app bundle.
    "scripts/design-fingerprint.js",
  ]),
]);

export default eslintConfig;
