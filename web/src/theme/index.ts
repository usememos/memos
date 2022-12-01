import { extendTheme } from "@mui/joy";

const theme = extendTheme({
  components: {
    JoySelect: {
      defaultProps: {
        size: "sm",
      },
    },
  },
});

export default theme;
