import { Visibility } from "@/types/proto/api/v1/memo_service";

export const convertVisibilityFromString = (visibility: string) => {
  switch (visibility) {
    case "PUBLIC":
      return Visibility.PUBLIC;
    case "PROTECTED":
      return Visibility.PROTECTED;
    case "PRIVATE":
      return Visibility.PRIVATE;
    default:
      return Visibility.PUBLIC;
  }
};

export const convertVisibilityToString = (visibility: Visibility) => {
  switch (visibility) {
    case Visibility.PUBLIC:
      return "PUBLIC";
    case Visibility.PROTECTED:
      return "PROTECTED";
    case Visibility.PRIVATE:
      return "PRIVATE";
    default:
      return "PRIVATE";
  }
};
