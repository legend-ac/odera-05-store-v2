import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
    "./src/lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          bg: "#f8fafc",
          card: "#ffffff",
          line: "#e2e8f0",
          text: "#0f172a",
          muted: "#475569",
          primary: "#020617",
          sale: "#e11d48",
          success: "#059669",
          info: "#2563eb",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui"],
        display: ["var(--font-display)", "var(--font-sans)"],
      },
    },
  },
  plugins: [],
};

export default config;
