import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: { 50: "#ecfdf3", 100: "#d1fadf", 500: "#12b76a", 600: "#039855", 700: "#027a48" },
        leave: { 100: "#f4ebff", 500: "#9e77ed", 600: "#7f56d9" },
      },
      fontFamily: {
        sans: ["Pretendard", "Apple SD Gothic Neo", "Malgun Gothic", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
} satisfies Config;
