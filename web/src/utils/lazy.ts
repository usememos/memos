import type { ComponentType } from "react";
import { lazy } from "react";

const reloadOnChunkLoadError = (error: unknown) => {
  const message = error instanceof Error ? error.message : "";
  const isChunkError =
    message.includes("Failed to fetch dynamically imported module") || message.includes("Importing a module script failed");
  const reloadKey = "chunk-reload";
  if (isChunkError && !sessionStorage.getItem(reloadKey)) {
    sessionStorage.setItem(reloadKey, "1");
    window.location.reload();
  }
};

export async function loadWithReload<T>(factory: () => Promise<T>): Promise<T> {
  try {
    return await factory();
  } catch (error) {
    reloadOnChunkLoadError(error);
    throw error;
  }
}

// Wrap lazy imports to auto-reload on chunk load failure (e.g., after redeployment).
// biome-ignore lint/suspicious/noExplicitAny: mirrors React.lazy's own constraint
export function lazyWithReload<T extends ComponentType<any>>(factory: () => Promise<{ default: T }>) {
  return lazy(() => loadWithReload(factory));
}
