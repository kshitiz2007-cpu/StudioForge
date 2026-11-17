import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        forge: {
          bg: "#090b0f",
          panel: "#10141b",
          raised: "#171d27",
          line: "#252d3a",
          muted: "#8792a4",
          text: "#e8edf5",
          accent: "#53d6a2",
        },
      },
      boxShadow: {
        panel: "0 12px 40px rgba(0,0,0,.28)",
      },
    },
  },
  plugins: [],
};
export default config;
