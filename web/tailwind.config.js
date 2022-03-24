/* eslint-disable no-undef */
module.exports = {
  content: ["./index.html", "./src/**/*.{js,ts,tsx}"],
  theme: {
    extend: {
      spacing: {
        128: "32rem",
        168: "42rem",
      },
      zIndex: {
        100: "100",
        1000: "1000",
      },
    },
  },
  plugins: [],
};
