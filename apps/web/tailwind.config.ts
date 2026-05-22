import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#18221d",
        smoke: "#f4f1eb",
        leaf: "#1f7a4d",
        warning: "#b42318",
        gold: "#c2872b"
      }
    }
  },
  plugins: []
};

export default config;
