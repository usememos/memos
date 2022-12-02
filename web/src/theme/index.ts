import { extendTheme } from "@mui/joy";

const theme = extendTheme({
  components: {
    JoyButton: {
      defaultProps: {
        size: "sm",
      },
    },
    JoySelect: {
      defaultProps: {
        size: "sm",
      },
    },
  },
});

export default theme;
