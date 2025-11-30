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
export { default, default as MemoView } from "./MemoView";
