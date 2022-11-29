import { extendTheme } from "@mui/joy";

const theme = extendTheme({
  components: {
    JoySelect: {
      styleOverrides: {
        root: {
          fontSize: "0.875rem",
        },
      },
    },
  },
});

export default theme;
