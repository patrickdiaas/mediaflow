import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["DM Sans", "sans-serif"],
        mono: ["DM Mono", "monospace"],
      },
      colors: {
        bg:             "#0c0a1e",
        card:           "#13112b",
        border:         "#252047",
        "border-light": "#2e2860",
        "text-primary":   "#e8e6f4",
        "text-secondary": "#9691b8",
        "text-muted":     "#504b78",
        accent:     "#00d084",
        "accent-dim": "#002916",
        blue:       "#6366f1",
        "blue-dim": "#1e1b4b",
        gold:       "#f59e0b",
        "gold-dim": "#2a1f05",
        red:        "#ef4444",
        "red-dim":  "#2d0a0a",
        purple:       "#a855f7",
        "purple-dim": "#200d3a",
      },
    },
  },
  plugins: [],
};

export default config;
