import type { Config } from "tailwindcss";
import animate from "tailwindcss-animate";

export default {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/modules/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/providers/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)", "Inter", "system-ui", "sans-serif"],
      },
      colors: {
        brand: {
          orange: "#F37021",
          navy: "#1C2431",
          canvas: "#F7F9FB",
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        ring: "hsl(var(--ring))",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      boxShadow: {
        card: "0 10px 40px -24px rgba(28, 36, 49, 0.35)",
        soft: "0 8px 30px rgba(28, 36, 49, 0.08)",
      },
      backgroundImage: {
        "auth-canvas":
          "radial-gradient(1200px circle at 15% 10%, hsl(20 89% 54% / 0.08), transparent 42%), radial-gradient(900px circle at 90% 80%, hsl(222 27% 15% / 0.06), transparent 45%), linear-gradient(180deg, hsl(var(--background)) 0%, hsl(210 40% 96%) 100%)",
        "auth-canvas-dark":
          "radial-gradient(900px circle at 20% 0%, hsl(20 89% 54% / 0.12), transparent 50%), linear-gradient(180deg, hsl(var(--background)) 0%, hsl(222 47% 5%) 100%)",
      },
      keyframes: {
        "fade-in": {
          from: { opacity: "0", transform: "translateY(4px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.35s ease-out both",
      },
    },
  },
  plugins: [animate],
} satisfies Config;
