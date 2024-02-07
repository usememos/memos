/* eslint-disable no-undef */
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./src/**/*.{js,ts,tsx}"],
  darkMode: "class",
  theme: {
    fontSize: {
      xs: ".75rem",
      sm: ".875rem",
      base: "1rem",
      lg: "1.125rem",
      xl: "1.25rem",
      "2xl": "1.5rem",
      "3xl": "1.875rem",
      "4xl": "2.25rem",
      "5xl": "2.5rem",
      "6xl": "3rem",
    },
    extend: {
      spacing: {
        112: "28rem",
        128: "32rem",
        180: "45rem",
      },
      zIndex: {
        1: "1",
        2: "2",
        20: "20",
        100: "100",
        1000: "1000",
      },
      gridTemplateRows: {
        7: "repeat(7, minmax(0, 1fr))",
      },
      keyframes: {
        wiggle: {
          "0%, 100%": { transform: "translateY(-25%);" },
          //"50%": { transform: "rotate(3deg)" },
        },
      },
      animation: {
        wiggle: "wiggle 1s ease-in-out",
      },
    },
  },
  plugins: [],
};
