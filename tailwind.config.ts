import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      fontFamily: {
        pixel: ["var(--font-pixel)", "system-ui", "sans-serif"]
      },
      colors: {
        ink: "#061229",
        panel: "#081d3d",
        neon: "#22b7ff",
        gold: "#f4a82c"
      }
    }
  },
  plugins: []
};

export default config;

