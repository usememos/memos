import { DownloadIcon, LoaderIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { getRequestToken } from "@/connect";
import { useTranslate } from "@/utils/i18n";
import SettingGroup from "./SettingGroup";

const ExportMemosSection = () => {
  const t = useTranslate();
  const [exporting, setExporting] = useState(false);
  const pending = useRef<AbortController | null>(null);

  useEffect(() => () => pending.current?.abort(), []);

  const exportMemos = async () => {
    if (pending.current) return;
    const controller = new AbortController();
    pending.current = controller;
    setExporting(true);
    try {
      const token = await getRequestToken();
      if (controller.signal.aborted) return;
      const response = await fetch("/file/memos/export", {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        credentials: "same-origin",
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new Error(t(response.status === 429 ? "setting.account.export-busy" : "setting.account.export-failed"));
      }
      const blob = await response.blob();
      if (controller.signal.aborted) return;
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `memos-export-${new Date().toISOString().slice(0, 10)}.zip`;
      try {
        document.body.appendChild(link);
        link.click();
      } finally {
        link.remove();
        // Give the browser time to start consuming the download before revoking it.
        window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
      }
    } catch (error) {
      if (!controller.signal.aborted) {
        toast.error(error instanceof Error ? error.message : t("setting.account.export-failed"));
      }
    } finally {
      pending.current = null;
      if (!controller.signal.aborted) setExporting(false);
    }
  };

  return (
    <SettingGroup showSeparator title={t("setting.account.export-memos")} description={t("setting.account.export-description")}>
      <div>
        <Button variant="outline" size="sm" disabled={exporting} onClick={exportMemos}>
          {exporting ? <LoaderIcon className="w-4 h-4 mr-1.5 animate-spin" /> : <DownloadIcon className="w-4 h-4 mr-1.5" />}
          {t(exporting ? "setting.account.export-preparing" : "setting.account.export-download")}
        </Button>
      </div>
    </SettingGroup>
  );
};

export default ExportMemosSection;
