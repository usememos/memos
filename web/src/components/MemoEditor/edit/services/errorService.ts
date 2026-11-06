import { getQuotaExceededMessage } from "@/lib/error";
import { translate } from "@/utils/i18n";

export const errorService = {
  getErrorMessage(error: unknown): string {
    const limitMessage = getQuotaExceededMessage(error);
    if (limitMessage !== undefined) {
      return limitMessage;
    }

    if (error && typeof error === "object" && "rawMessage" in error) {
      return (error as { rawMessage?: string }).rawMessage || translate("common.error-occurred");
    }

    // Handle ConnectError or errors with details property
    if (error && typeof error === "object" && "details" in error) {
      return (error as { details?: string }).details || translate("common.error-occurred");
    }

    if (error instanceof Error) {
      return error.message;
    }

    return translate("common.unknown-error");
  },
};
