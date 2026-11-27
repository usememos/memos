import { Toast } from "@usememos/ui";

/**
 * The app's one toast manager. Code anywhere, inside React or not, adds toasts to it with
 * `toast.add({ title, type })`; main.tsx hands it to the `Toast.Provider` that renders them.
 * Errors stay until dismissed: pass `type: "danger"` with `timeout: 0`.
 */
export const toast = Toast.createToastManager();

/** Reports an error as a toast that stays until dismissed; `handleError` takes it as its reporter. */
export const showErrorToast = (title: string): void => {
  toast.add({ title, type: "danger", timeout: 0 });
};
