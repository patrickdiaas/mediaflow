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
        bg:           "#0a0c10",
        card:         "#0f1117",
        border:       "#1e2230",
        "border-light": "#252b3b",
        "text-primary":   "#e8eaf0",
        "text-secondary": "#8b92a8",
        "text-muted":     "#4a5068",
        accent:     "#00d084",
        "accent-dim": "#00200f",
        blue:       "#3b82f6",
        "blue-dim": "#0d1f3c",
        gold:       "#f59e0b",
        "gold-dim": "#2a1f05",
        red:        "#ef4444",
        "red-dim":  "#2a0a0a",
        purple:       "#a855f7",
        "purple-dim": "#1e0a35",
      },
    },
  },
  plugins: [],
};

export default config;
