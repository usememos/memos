import { useEffect } from "react";
import { cacheService } from "../services";

export const useAutoSave = (content: string, username: string, cacheKey: string | undefined) => {
  useEffect(() => {
    const key = cacheService.key(username, cacheKey);
    cacheService.save(key, content);
  }, [content, username, cacheKey]);
};
