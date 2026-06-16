import type { Config } from "tailwindcss";
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        navy: "#0B1F3A",
        navysoft: "#16304f",
        cream: "#F7F3EA",
        creamcard: "#FCFAF4",
        line: "#E3DCCB",
        gold: "#B08642",
        danger: "#C0392B",
      },
      fontFamily: {
        serif: ["Georgia", "Cormorant Garamond", "serif"],
      },
    },
  },
  plugins: [],
};
export default config;
