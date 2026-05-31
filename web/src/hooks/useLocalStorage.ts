import { useCallback, useEffect, useRef, useState } from "react";

type SetLocalStorageValue<T> = T | ((currentValue: T) => T);

const readLocalStorageValue = <T>(key: string, defaultValue: T): T => {
  if (typeof window === "undefined") {
    return defaultValue;
  }

  try {
    const storedValue = window.localStorage.getItem(key);
    return storedValue === null ? defaultValue : (JSON.parse(storedValue) as T);
  } catch {
    return defaultValue;
  }
};

export const useLocalStorage = <T>(key: string, defaultValue: T): [T, (value: SetLocalStorageValue<T>) => void] => {
  const defaultValueRef = useRef(defaultValue);
  defaultValueRef.current = defaultValue;

  const [storedValue, setStoredValue] = useState<T>(() => readLocalStorageValue(key, defaultValue));

  useEffect(() => {
    setStoredValue(readLocalStorageValue(key, defaultValueRef.current));
  }, [key]);

  const setValue = useCallback(
    (value: SetLocalStorageValue<T>) => {
      setStoredValue((currentValue) => {
        const nextValue = typeof value === "function" ? (value as (currentValue: T) => T)(currentValue) : value;

        if (typeof window !== "undefined") {
          try {
            window.localStorage.setItem(key, JSON.stringify(nextValue));
          } catch {
            // Keep React state updated even if persistence is unavailable.
          }
        }

        return nextValue;
      });
    },
    [key],
  );

  return [storedValue, setValue];
};
