/* eslint-disable no-undef */
/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  prefix: "",
  theme: {
    extend: {
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
