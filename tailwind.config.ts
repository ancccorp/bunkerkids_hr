import type { Config } from "tailwindcss";

const ink = { 50: "#f7f8fa", 100: "#f0f2f5", 200: "#e4e7ec", 300: "#d0d5dd", 400: "#98a2b3", 500: "#667085", 600: "#475467", 700: "#344054", 800: "#1d2939", 900: "#101828" };

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: { 50: "#ecfdf3", 100: "#d1fadf", 200: "#a6f4c5", 500: "#12b76a", 600: "#039855", 700: "#027a48", 900: "#054f31" },
        ink,
        gray: ink,
        leave: { 100: "#f4ebff", 500: "#9e77ed", 600: "#7f56d9" },
      },
      boxShadow: {
        card: "0 1px 2px rgba(16,24,40,0.04), 0 1px 3px rgba(16,24,40,0.03)",
        pop: "0 12px 32px -8px rgba(16,24,40,0.18)",
      },
      fontFamily: {
        sans: ["var(--font-pretendard)", "Pretendard", "Apple SD Gothic Neo", "Malgun Gothic", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
} satisfies Config;
