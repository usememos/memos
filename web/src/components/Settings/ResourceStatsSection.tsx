import { useQueryClient } from "@tanstack/react-query";
import { Button, List } from "@usememos/ui";
import { RefreshCwIcon } from "lucide-react";
import { instanceKeys, useInstanceStats } from "@/hooks/useInstanceQueries";
import { formatFileSize } from "@/utils/format";
import { useTranslate } from "@/utils/i18n";
import SettingGroup from "./SettingGroup";
import { SettingList, StatRow } from "./SettingList";
import SettingSection from "./SettingSection";

const formatRelativeTime = (date: Date): string => {
  const seconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
};

const renderBytes = (value: bigint | number | undefined, unknown: string): string => {
  if (value === undefined) return unknown;
  const n = typeof value === "bigint" ? Number(value) : value;
  if (n < 0) return unknown;
  return formatFileSize(n);
};

const ResourceStatsSection = () => {
  const t = useTranslate();
  const queryClient = useQueryClient();
  const { data, isLoading, isError, isFetching } = useInstanceStats();

  const unknown = t("setting.resource-stats.unknown");
  const generatedTime = data?.generatedTime
    ? t("setting.resource-stats.last-updated", {
        ago: formatRelativeTime(new Date(Number(data.generatedTime.seconds) * 1000)),
      })
    : undefined;

  return (
    <SettingSection
      title={t("setting.resource-stats.title")}
      description={t("setting.resource-stats.description")}
      actions={
        <>
          {generatedTime ? <span className="mu-caption text-mu-text-secondary">{generatedTime}</span> : null}
          <Button
            variant="neutral"
            disabled={isFetching}
            onClick={() => void queryClient.invalidateQueries({ queryKey: instanceKeys.stats() })}
            icon={<RefreshCwIcon />}
          >
            {t("setting.resource-stats.refresh")}
          </Button>
        </>
      }
    >
      {isError ? <div className="text-mu-danger mu-body">{t("setting.resource-stats.load-error")}</div> : null}

      {isLoading && !data ? (
        <SettingList aria-busy aria-label={t("setting.resource-stats.label")}>
          <List.Item>
            <span className="text-mu-text-secondary">…</span>
          </List.Item>
        </SettingList>
      ) : null}

      {data ? (
        <>
          <SettingGroup title={t("setting.resource-stats.database.title")}>
            <SettingList>
              <StatRow label={t("setting.resource-stats.database.driver")} value={data.database?.driver || unknown} />
              <StatRow label={t("setting.resource-stats.database.size")} value={renderBytes(data.database?.sizeBytes, unknown)} />
            </SettingList>
          </SettingGroup>

          <SettingGroup title={t("setting.resource-stats.local-storage.title")} showSeparator>
            <SettingList>
              <StatRow label={t("setting.resource-stats.local-storage.size")} value={renderBytes(data.localStorageBytes, unknown)} />
            </SettingList>
          </SettingGroup>
        </>
      ) : null}
    </SettingSection>
  );
};

export default ResourceStatsSection;
