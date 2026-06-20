/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#2C2621",
        panel: "#F7F2EB",
        line: "#E5D5C5",
        accent: "#00C2CB",
        stone: "#E5D5C5",
        sand: "#F7F2EB",
      },
      boxShadow: {
        soft: "0 18px 60px rgba(44, 38, 33, 0.12)",
      },
    },
  },
  plugins: [],
};
