import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#18221d",
        smoke: "#f4f1eb",
        leaf: "#1f7a4d",
        // Deep brand green (matches the app icon/splash) for anchor sections.
        deepgreen: "#0e3b34",
        warning: "#b42318",
        gold: "#c2872b"
      },
      fontFamily: {
        display: ["var(--font-display)", "Georgia", "Cambria", "serif"],
        sans: ["var(--font-sans)", "system-ui", "-apple-system", "Segoe UI", "sans-serif"]
      }
    }
  },
  plugins: []
};

export default config;
