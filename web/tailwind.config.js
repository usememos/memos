/* eslint-disable no-undef */
module.exports = {
  content: ["./index.html", "./src/**/*.{js,ts,tsx}"],
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
    },
    extend: {
      spacing: {
        112: "28rem",
        128: "32rem",
        180: "45rem",
      },
      zIndex: {
        1: "1",
        20: "20",
        100: "100",
        1000: "1000",
      },
      gridTemplateRows: {
        7: "repeat(7, minmax(0, 1fr))",
      },
    },
  },
};
