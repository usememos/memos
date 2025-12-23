import type { Translations } from "@/utils/i18n";

export type EditorErrorCode = "UPLOAD_FAILED" | "SAVE_FAILED" | "VALIDATION_FAILED" | "LOAD_FAILED";

export class EditorError extends Error {
  constructor(
    public code: EditorErrorCode,
    public details?: unknown,
  ) {
    super(`Editor error: ${code}`);
    this.name = "EditorError";
  }
}

export const errorService = {
  handle(error: unknown, t: (key: Translations, params?: Record<string, any>) => string): string {
    if (error instanceof EditorError) {
      // Try to get localized error message
      const key = `editor.error.${error.code.toLowerCase()}` as Translations;
      return t(key, { details: error.details });
    }

    if (error && typeof error === "object" && "details" in error) {
      return (error as { details?: string }).details || "An unknown error occurred";
    }

    if (error instanceof Error) {
      return error.message;
    }

    return "An unknown error occurred";
  },
};
