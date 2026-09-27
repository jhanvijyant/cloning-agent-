import type { Config } from "tailwindcss";

// Restrained palette on purpose: this tool is a developer workbench,
// not an "AI SaaS" marketing page. One accent color, neutral grays.
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        accent: "#2563eb",
      },
      borderRadius: {
        DEFAULT: "6px",
      },
    },
  },
  plugins: [],
};
export default config;
