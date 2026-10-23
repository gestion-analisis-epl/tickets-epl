import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const config = [
  ...nextVitals,
  ...nextTs,
  { rules: { "react-hooks/set-state-in-effect": "warn" } },
  { ignores: [".next/**", "node_modules/**", "next-env.d.ts"] },
];

export default config;
