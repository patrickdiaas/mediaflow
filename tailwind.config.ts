import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: "#090b10",
        card: "#0e1018",
        border: "#171b28",
        "border-light": "#1e2333",
        "text-primary": "#e8eaf0",
        "text-secondary": "#6b7280",
        "text-muted": "#3f475a",
        accent: "#4ade80",
        "accent-dim": "#16a34a",
        blue: "#5b9bd5",
        "blue-dim": "#1e3a5f",
        gold: "#c9a84c",
        "gold-dim": "#4a3a1a",
        red: "#f87171",
        "red-dim": "#450a0a",
      },
      fontFamily: {
        sans: ["DM Sans", "sans-serif"],
        mono: ["DM Mono", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
