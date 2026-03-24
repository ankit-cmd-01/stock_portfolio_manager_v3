/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        base: "rgb(var(--bg-base-rgb) / <alpha-value>)",
        surface: "rgb(var(--bg-surface-rgb) / <alpha-value>)",
        elevated: "rgb(var(--bg-elevated-rgb) / <alpha-value>)",
        border: "rgb(var(--border-rgb) / <alpha-value>)",
        primary: "rgb(var(--accent-primary-rgb) / <alpha-value>)",
        profit: "rgb(var(--accent-green-rgb) / <alpha-value>)",
        loss: "rgb(var(--accent-red-rgb) / <alpha-value>)",
        gold: "rgb(var(--accent-gold-rgb) / <alpha-value>)",
        text: "rgb(var(--text-primary-rgb) / <alpha-value>)",
        muted: "rgb(var(--text-muted-rgb) / <alpha-value>)",
        dim: "rgb(var(--text-dim-rgb) / <alpha-value>)",
      },
      fontFamily: {
        display: ['"Syne"', "sans-serif"],
        body: ['"DM Sans"', "sans-serif"],
        mono: ['"JetBrains Mono"', "monospace"],
      },
      boxShadow: {
        panel: "0 4px 24px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.04)",
        cyan: "0 0 20px rgba(0, 212, 255, 0.3)",
        green: "0 0 15px rgba(0, 230, 118, 0.25)",
      },
      borderRadius: {
        chip: "4px",
        card: "8px",
        panel: "12px",
        modal: "20px",
      },
      animation: {
        shimmer: "shimmer 1.6s linear infinite",
        pulseGlow: "pulseGlow 2.4s ease-in-out infinite",
        routeFade: "routeFade 0.2s ease-out",
        floatUp: "floatUp 0.6s ease-out forwards",
        drift: "drift 6s ease-in-out infinite",
      },
      keyframes: {
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        pulseGlow: {
          "0%, 100%": { boxShadow: "0 0 0 rgba(255, 61, 87, 0)" },
          "50%": { boxShadow: "0 0 18px rgba(255, 61, 87, 0.45)" },
        },
        routeFade: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        floatUp: {
          "0%": { opacity: "0", transform: "translateY(20px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        drift: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-8px)" },
        },
      },
    },
  },
  plugins: [],
};
