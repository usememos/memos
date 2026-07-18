import { loadWithReload } from "@/utils/lazy";

type MemoEditorModule = typeof import(".");

let memoEditorModulePromise: Promise<MemoEditorModule> | undefined;

// Share one in-flight request across edit and comment entry points. Callers
// keep their current UI mounted until this promise resolves.
export const loadMemoEditor = (): Promise<MemoEditorModule> => {
  memoEditorModulePromise ??= loadWithReload(() => import(".")).catch((error) => {
    memoEditorModulePromise = undefined;
    throw error;
  });
  return memoEditorModulePromise;
};
