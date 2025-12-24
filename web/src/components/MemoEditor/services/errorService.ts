export const errorService = {
  getErrorMessage(error: unknown): string {
    // Handle ConnectError or errors with details property
    if (error && typeof error === "object" && "details" in error) {
      return (error as { details?: string }).details || "An error occurred";
    }

    if (error instanceof Error) {
      return error.message;
    }

    return "An unknown error occurred";
  },
};
