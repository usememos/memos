import { extendTheme } from "@mui/joy";

const theme = extendTheme({
  colorSchemes: {
    light: {
      palette: {
        primary: {
          50: "#f0fdfa",
          100: "#ccfbf1",
          200: "#99f6e4",
          300: "#5eead4",
          400: "#0d9488",
          500: "#0d9488", // Use teal-600 as main color
          600: "#0f766e", // teal-700
          700: "#115e59", // teal-800
          800: "#0d5a56",
          900: "#134e4a",
          outlinedBorder: "#d1d5db", // Light gray for unchecked state (gray-300)
        },
      },
    },
    dark: {
      palette: {
        primary: {
          50: "#f0fdfa",
          100: "#ccfbf1",
          200: "#99f6e4",
          300: "#5eead4",
          400: "#0d9488",
          500: "#0d9488", // Use teal-600 as main color
          600: "#0f766e", // teal-700
          700: "#115e59", // teal-800
          800: "#0d5a56",
          900: "#134e4a",
          outlinedBorder: "#4b5563", // Darker gray for dark mode (gray-600)
        },
      },
    },
  },
  components: {
    JoyButton: {
      defaultProps: {
        size: "sm",
      },
    },
    JoyInput: {
      defaultProps: {
        size: "sm",
      },
    },
    JoySelect: {
      defaultProps: {
        size: "sm",
      },
      styleOverrides: {
        listbox: {
          zIndex: 9999,
        },
      },
    },
    JoyAutocomplete: {
      styleOverrides: {
        listbox: {
          zIndex: 9999,
        },
      },
    },
  },
});

export default theme;
