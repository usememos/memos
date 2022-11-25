import { useEffect } from "react";
import { useColorScheme } from "@mui/joy/styles";

import { APPERANCE_OPTIONS, APPERANCE_OPTIONS_STORAGE_KEY } from "../helpers/consts";
import useLocalStorage from "./useLocalStorage";

export type Apperance = typeof APPERANCE_OPTIONS[number];

const useApperance = () => {
  const [apperance, setApperance] = useLocalStorage<Apperance>(APPERANCE_OPTIONS_STORAGE_KEY, APPERANCE_OPTIONS[0]);

  const { setMode } = useColorScheme();

  useEffect(() => {
    const root = document.documentElement;
    if (apperance === "dark" || (apperance === "auto" && window.matchMedia("(prefers-color-scheme: dark)").matches)) {
      root.classList.add("dark");
      setMode("dark");
    } else {
      root.classList.remove("dark");
      setMode("light");
    }
  }, [apperance]);

  return [apperance, setApperance] as const;
};

export default useApperance;
