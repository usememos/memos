/**
 * MemoView component and related exports
 *
 * This module provides a fully refactored MemoView component with:
 * - Separation of concerns via custom hooks
 * - Smaller, focused sub-components
 * - Proper TypeScript types
 * - Better maintainability and testability
 */

export { MemoBody, MemoHeader } from "./components";
export * from "./constants";
export type {
  UseMemoEditorReturn,
  UseMemoHandlersOptions,
  UseMemoHandlersReturn,
  UseMemoViewDerivedStateOptions,
  UseMemoViewDerivedStateReturn,
} from "./hooks";
export {
  useImagePreview,
  useKeyboardShortcuts,
  useMemoActions,
  useMemoCreator,
  useMemoEditor,
  useMemoHandlers,
  useMemoViewDerivedState,
  useNsfwContent,
} from "./hooks";
export { default, default as MemoView } from "./MemoView";
export type { MemoViewContextValue } from "./MemoViewContext";
export { MemoViewContext, useMemoViewContext } from "./MemoViewContext";
export type {
  ImagePreviewState,
  MemoBodyProps,
  MemoHeaderProps,
  MemoViewProps,
  UseImagePreviewReturn,
  UseKeyboardShortcutsOptions,
  UseMemoActionsReturn,
  UseNsfwContentReturn,
} from "./types";
