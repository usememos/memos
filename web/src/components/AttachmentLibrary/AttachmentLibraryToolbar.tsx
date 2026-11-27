import { Toggle, ToggleGroup } from "@usememos/ui";
import { FileAudioIcon, FileStackIcon, ImageIcon } from "lucide-react";
import type { ComponentType } from "react";
import type { AttachmentLibraryStats, AttachmentLibraryTab } from "@/hooks/useAttachmentLibrary";
import { useTranslate } from "@/utils/i18n";

interface AttachmentLibraryToolbarProps {
  activeTab: AttachmentLibraryTab;
  onTabChange: (tab: AttachmentLibraryTab) => void;
  stats: AttachmentLibraryStats;
}

const TAB_CONFIG: Array<{
  key: AttachmentLibraryTab;
  labelKey: "media" | "documents" | "audio";
  icon: ComponentType<{ className?: string }>;
  count: (stats: AttachmentLibraryStats) => number;
}> = [
  { key: "media", labelKey: "media", icon: ImageIcon, count: (stats) => stats.media },
  { key: "audio", labelKey: "audio", icon: FileAudioIcon, count: (stats) => stats.audio },
  { key: "documents", labelKey: "documents", icon: FileStackIcon, count: (stats) => stats.documents },
];

const AttachmentLibraryToolbar = ({ activeTab, onTabChange, stats }: AttachmentLibraryToolbarProps) => {
  const t = useTranslate();

  return (
    <div className="-mx-1 overflow-x-auto px-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <ToggleGroup
        aria-label={t("common.attachments")}
        value={[activeTab]}
        onValueChange={([next]: string[]) => next && onTabChange(next as AttachmentLibraryTab)}
      >
        {TAB_CONFIG.map((tab) => {
          const Icon = tab.icon;
          return (
            <Toggle key={tab.key} value={tab.key} icon={<Icon />}>
              {t(`attachment-library.tabs.${tab.labelKey}`)}
              <span className="ms-1 tabular-nums text-mu-text-secondary">{tab.count(stats)}</span>
            </Toggle>
          );
        })}
      </ToggleGroup>
    </div>
  );
};

export default AttachmentLibraryToolbar;
