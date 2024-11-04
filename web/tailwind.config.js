/* eslint-disable no-undef */
/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  prefix: "",
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#0d9488", // Teal 600
          dark: "#0f766e", // Teal 700
          darker: "#0d5a56", // Teal 800
        },
        success: {
          DEFAULT: "#16a34a", // Green 600
          dark: "#047857", // Green 700
          darker: "#03664a", // Green 800
        },
        danger: {
          DEFAULT: "#dc2626", // Red 600
          dark: "#b91c1c", // Red 700
          darker: "#991b1b", // Red 800
        },
        warning: {
          DEFAULT: "#ca8a04", // Yellow 600
          dark: "#b45309", // Yellow 700
          darker: "#92400e", // Yellow 800
        },
      },
      spacing: {
        128: "32rem",
      },
      zIndex: {
        1: "1",
        2: "2",
        20: "20",
        100: "100",
        1000: "1000",
        2000: "2000",
      },
      gridTemplateRows: {
        7: "repeat(7, minmax(0, 1fr))",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
