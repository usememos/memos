export type TableData = Record<string, unknown>;

export interface ApiError {
  message: string;
  code?: string;
  details?: unknown;
}

export function isApiError(error: unknown): error is ApiError {
  return typeof error === "object" && error !== null && "message" in error && typeof (error as ApiError).message === "string";
}

export type ToastFunction = (message: string) => void | Promise<void>;
