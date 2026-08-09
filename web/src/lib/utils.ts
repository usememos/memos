import { type ClassValue, clsx } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

const mergeTailwindClasses = extendTailwindMerge({
  extend: {
    theme: {
      text: ["2xs", "ui"],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return mergeTailwindClasses(clsx(inputs));
}
