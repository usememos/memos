import { useEffect } from "react";
import { useColorScheme } from "@mui/joy/styles";
import { useAppSelector } from "../store";
import { globalService } from "../services";

const getSystemColorScheme = () => {
  if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) {
    return "dark";
  } else {
    return "light";
  }
};

const useAppearance = () => {
  const user = useAppSelector((state) => state.user.user);
  const appearance = useAppSelector((state) => state.global.appearance);
  const { mode, setMode } = useColorScheme();

  useEffect(() => {
    if (user) {
      globalService.setAppearance(user.setting.appearance);
    }
  }, [user]);

  useEffect(() => {
    let mode = appearance;
    if (appearance === "system") {
      mode = getSystemColorScheme();
    }
    setMode(mode);
  }, [appearance]);

  useEffect(() => {
    const colorSchemeChangeHandler = (event: MediaQueryListEvent) => {
      const newColorScheme = event.matches ? "dark" : "light";
      if (globalService.getState().appearance === "system") {
        setMode(newColorScheme);
      }
    };

    if (appearance !== "system") {
      window.matchMedia("(prefers-color-scheme: dark)").removeEventListener("change", colorSchemeChangeHandler);
      return;
    }

    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", colorSchemeChangeHandler);

    return () => {
      window.matchMedia("(prefers-color-scheme: dark)").removeEventListener("change", colorSchemeChangeHandler);
    };
  }, [appearance]);

  useEffect(() => {
    const root = document.documentElement;
    if (mode === "dark") {
      root.classList.add("dark");
    } else if (mode === "light") {
      root.classList.remove("dark");
    }
  }, [mode]);

  return [appearance, globalService.setAppearance] as const;
};

export default useAppearance;
