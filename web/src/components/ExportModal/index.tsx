import { Modal, Tabs, Tab, TabList, Select, Option } from "@mui/joy";
import { Button } from "@usememos/mui";
import { toPng } from "html-to-image";
import { useState, useRef, useEffect } from "react";
import { Memo } from "@/types/proto/api/v1/memo_service";
import { useTranslate } from "@/utils/i18n";
import DefaultTemplate from "./templates/DefaultTemplate";
import TwitterTemplate from "./templates/TwitterTemplate";

interface ExportModalProps {
  memo: Memo;
  onClose: () => void;
}

type TemplateType = "default" | "twitter";
type BackgroundType = "none" | "gradient" | "pattern";

// Storage keys for persisting user preferences
const STORAGE_KEY_TEMPLATE = "memos-export-template";
const STORAGE_KEY_BACKGROUND = "memos-export-background";

const ExportModal = ({ memo, onClose }: ExportModalProps) => {
  const t = useTranslate();
  const [template, setTemplate] = useState<TemplateType | null>(null);
  const [background, setBackground] = useState<BackgroundType | null>(null);
  const exportRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);

  // Load saved preferences when component mounts
  useEffect(() => {
    const savedTemplate = localStorage.getItem(STORAGE_KEY_TEMPLATE) as TemplateType;
    const savedBackground = localStorage.getItem(STORAGE_KEY_BACKGROUND) as BackgroundType;

    setTemplate(savedTemplate || "default");
    setBackground(savedBackground || "none");
  }, []);

  // Save preferences when they change
  const handleTemplateChange = (value: TemplateType) => {
    setTemplate(value);
    localStorage.setItem(STORAGE_KEY_TEMPLATE, value);
  };

  const handleBackgroundChange = (value: BackgroundType) => {
    setBackground(value);
    localStorage.setItem(STORAGE_KEY_BACKGROUND, value);
  };

  const handleExport = async () => {
    if (!exportRef.current) return;

    setIsExporting(true);
    try {
      const dataUrl = await toPng(exportRef.current, {
        quality: 1.0,
        pixelRatio: 2,
        cacheBust: true,
        skipFonts: false,
        fontEmbedCSS: "",
      });

      // Download the image
      const link = document.createElement("a");
      link.href = dataUrl;
      // Extract ID from memo.name (format: "users/username/memos/id")
      const memoId = memo.name.split("/").pop() || "export";
      link.download = `memo-${memoId}.png`;
      link.click();
    } catch (error) {
      console.error("Failed to export image:", error);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Modal
      open={true}
      onClose={onClose}
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        p: "10px",
      }}
    >
      <div className="bg-white dark:bg-zinc-800 rounded-lg p-4 flex flex-col max-h-[calc(100vh-100px)] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-medium">{t("common.export")}</h2>
          <Button variant="plain" color="primary" onClick={onClose}>
            {t("common.close")}
          </Button>
        </div>

        <div className="flex flex-col md:flex-row gap-4 mb-4 overflow-y-auto">
          <div className="w-full md:w-[240px] flex-shrink-0">
            <div className="mb-4">
              <h3 className="text-sm font-medium mb-2">{t("common.template")}</h3>
              <Tabs
                value={template}
                onChange={(_, value) => handleTemplateChange(value as TemplateType)}
                orientation="vertical"
                sx={{ borderRadius: "md" }}
              >
                <TabList sx={{ width: "100%" }}>
                  <Tab value="default" sx={{ flexGrow: 1 }}>
                    {t("exportImage.template.default")}
                  </Tab>
                  <Tab value="twitter" sx={{ flexGrow: 1 }}>
                    {t("exportImage.template.twitter")}
                  </Tab>
                </TabList>
              </Tabs>
            </div>

            <div className="mb-4">
              <h3 className="text-sm font-medium mb-2">{t("common.background")}</h3>
              <Select value={background} onChange={(_, value) => handleBackgroundChange(value as BackgroundType)} sx={{ width: "100%" }}>
                <Option value="none">{t("exportImage.background.none")}</Option>
                <Option value="gradient">{t("exportImage.background.gradient")}</Option>
                <Option value="pattern">{t("exportImage.background.pattern")}</Option>
              </Select>
            </div>

            <Button fullWidth onClick={handleExport} disabled={isExporting} color="primary">
              {t("common.export")}
            </Button>
          </div>

          <div className="w-full md:flex-grow overflow-y-auto">
            <div className="p-4 rounded-lg border border-gray-200 dark:border-zinc-700 flex justify-center h-full overflow-y-scroll">
              <div
                id="export-container"
                ref={exportRef}
                className="relative md:w-[400px] w-[calc(100vw-60px)] h-max"
                style={{
                  background:
                    background === "gradient"
                      ? "linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)"
                      : background === "pattern"
                        ? "radial-gradient(#e5e7eb 1px, transparent 1px)"
                        : "transparent",
                  backgroundSize: background === "pattern" ? "20px 20px" : "auto",
                  padding: background !== "none" ? "2rem" : "0",
                  boxSizing: "border-box",
                }}
              >
                {template === "default" && <DefaultTemplate memo={memo} />}
                {template === "twitter" && <TwitterTemplate memo={memo} />}
              </div>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default ExportModal;
