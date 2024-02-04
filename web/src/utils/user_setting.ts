import { Mode } from "@/types/proto/store/user_setting";

export const convertMemoModeFromString = (mode: string) => {
  switch (mode) {
    case "FULL":
      return Mode.FULL;
    case "COMPACT":
      return Mode.COMPACT;
    default:
      return Mode.FULL;
  }
};

export const convertMemoModeToString = (mode: Mode) => {
  switch (mode) {
    case Mode.FULL:
      return "FULL";
    case Mode.COMPACT:
      return "COMPACT";
    default:
      return "FULL";
  }
};
