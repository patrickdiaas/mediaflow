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
        sans:    ["Plus Jakarta Sans", "sans-serif"],
        display: ["Unbounded", "cursive"],
        mono:    ["JetBrains Mono", "monospace"],
      },
      colors: {
        bg:             "#0A0A0C",
        surface:        "#111114",
        card:           "#16161A",
        "card-hover":   "#1C1C22",
        border:         "#24242C",
        "border-light": "#32323E",
        "text-primary":   "#F2F2F5",
        "text-secondary": "#A0A0B0",
        "text-muted":     "#6A6A7A",
        "text-dark":      "#3A3A48",
        accent:     "#CAFF04",
        "accent-dim": "#1a1f00",
        "accent-mid": "#2e3600",
        pop:        "#FF6B35",
        "pop-dim":  "#2a1200",
        blue:       "#3B82C4",
        "blue-dim": "#0d1a2e",
        gold:       "#FF6B35",
        "gold-dim": "#2a1200",
        red:        "#D95050",
        "red-dim":  "#2a0c0c",
        green:      "#2D9B6A",
        "green-dim":"#0a1e12",
      },
    },
  },
  plugins: [],
};

export default config;
