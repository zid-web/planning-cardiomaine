import nextConfig from "eslint-config-next";

const eslintConfig = [
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "public/**",
      "next-env.d.ts",
      "supabase/**",
      "scripts/**",
      "*.config.js",
      "*.config.mjs",
    ],
  },
  ...nextConfig,
  {
    rules: {
      // Existing codebase is large and v0-generated; keep these as warnings so
      // `bun run lint` runs and surfaces issues without failing on pre-existing debt.
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": "warn",
      "react/no-unescaped-entities": "warn",
      "react-hooks/exhaustive-deps": "warn",
      "@next/next/no-img-element": "warn",
      "prefer-const": "warn",
      // React Compiler rules (react-hooks v6) flag pre-existing patterns across
      // the codebase; keep as warnings so lint stays green while surfacing them.
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/purity": "warn",
      "react-hooks/immutability": "warn",
    },
  },
];

export default eslintConfig;
