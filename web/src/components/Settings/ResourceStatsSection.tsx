import { useQueryClient } from "@tanstack/react-query";
import { RefreshCwIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { instanceKeys, useInstanceStats } from "@/hooks/useInstanceQueries";
import { useTranslate } from "@/utils/i18n";
import SettingGroup from "./SettingGroup";
import { SettingList, SettingListItem, SettingPanel } from "./SettingList";
import SettingSection from "./SettingSection";

const formatBytes = (bytes: number | bigint): string => {
  const n = typeof bytes === "bigint" ? Number(bytes) : bytes;
  if (n < 0) return "—";
  if (n === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(units.length - 1, Math.floor(Math.log(n) / Math.log(1024)));
  return `${(n / 1024 ** i).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
};

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
  return formatBytes(n);
};

const StatValue = ({ value }: { value: string }) => (
  <span className="block min-w-0 max-w-full break-all text-right font-mono text-sm tabular-nums text-foreground">{value}</span>
);

const StatRow = ({ label, value }: { label: string; value: string }) => (
  <SettingListItem label={label} controlClassName="w-full justify-end sm:w-auto">
    <StatValue value={value} />
  </SettingListItem>
);

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
          {generatedTime ? <span className="text-xs text-muted-foreground">{generatedTime}</span> : null}
          <Button
            variant="outline"
            size="sm"
            disabled={isFetching}
            onClick={() => void queryClient.invalidateQueries({ queryKey: instanceKeys.stats() })}
          >
            <RefreshCwIcon className="mr-1 size-4" />
            {t("setting.resource-stats.refresh")}
          </Button>
        </>
      }
    >
      {isError ? <div className="text-destructive text-sm">{t("setting.resource-stats.load-error")}</div> : null}

      {isLoading && !data ? (
        <SettingPanel>
          <div className="px-3 py-3 text-sm text-muted-foreground">…</div>
        </SettingPanel>
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
