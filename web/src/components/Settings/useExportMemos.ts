import { useState } from "react";
import toast from "react-hot-toast";
import { getErrorMessage } from "@/lib/error";
import { exportMemos, MemoExportError } from "@/lib/memo-export";
import { useTranslate } from "@/utils/i18n";

// useExportMemos starts a memo export download for a username and reports the
// outcome with a toast. Only instance administrators may export.
export const useExportMemos = () => {
  const t = useTranslate();
  const [exporting, setExporting] = useState(false);

  const run = async (username: string) => {
    setExporting(true);
    try {
      await exportMemos(username);
      toast.success(t("setting.memo-export.export-success"));
    } catch (error) {
      if (error instanceof MemoExportError && error.status === 429) {
        toast.error(t("setting.memo-export.export-busy"));
      } else {
        toast.error(getErrorMessage(error, t("setting.memo-export.export-failed")));
      }
    } finally {
      setExporting(false);
    }
  };

  return { exportMemos: run, exporting };
};
