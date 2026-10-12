import useCurrentUser from "@/hooks/useCurrentUser";
import { useUserUsage } from "@/hooks/useUserQueries";
import { UsageLimit_Metric } from "@/types/proto/api/instance_service_pb";
import { useTranslate } from "@/utils/i18n";
import SettingGroup from "./SettingGroup";
import { SettingList, StatRow } from "./SettingList";
import { formatLimitValue } from "./usageLimitValues";

/**
 * Shows the current user's usage against their usage limits. It renders
 * nothing when no limit applies, so instances without limits look as before.
 */
const UsageSection = () => {
  const t = useTranslate();
  const user = useCurrentUser();
  const { data: usage } = useUserUsage(user?.name);

  if (!usage) return null;

  const memoCountLimit = usage.memoCountLimit?.value ?? 0n;
  const storageLimit = usage.storageBytesLimit?.value ?? 0n;
  const fileSizeLimit = usage.uploadBytesLimit?.value ?? 0n;
  const contentSizeLimit = usage.memoContentBytesLimit?.value ?? 0n;
  if (memoCountLimit === 0n && storageLimit === 0n && fileSizeLimit === 0n && contentSizeLimit === 0n) return null;

  const of = (metric: UsageLimit_Metric, used: bigint, limit: bigint) =>
    limit === 0n
      ? formatLimitValue(metric, used)
      : t("setting.account.usage-of", { usage: formatLimitValue(metric, used), limit: formatLimitValue(metric, limit) });

  return (
    <SettingGroup showSeparator title={t("setting.account.usage-title")} description={t("setting.account.usage-description")}>
      <SettingList>
        <StatRow label={t("setting.account.usage-memos")} value={of(UsageLimit_Metric.MEMO_COUNT, usage.memoCount, memoCountLimit)} />
        <StatRow label={t("setting.account.usage-storage")} value={of(UsageLimit_Metric.STORAGE_BYTES, usage.storageBytes, storageLimit)} />
        {contentSizeLimit > 0n && (
          <StatRow
            label={t("setting.usage-limits.content-size-column")}
            value={formatLimitValue(UsageLimit_Metric.MEMO_CONTENT_BYTES, contentSizeLimit)}
          />
        )}
        {fileSizeLimit > 0n && (
          <StatRow label={t("setting.account.usage-file-size")} value={formatLimitValue(UsageLimit_Metric.UPLOAD_BYTES, fileSizeLimit)} />
        )}
      </SettingList>
    </SettingGroup>
  );
};

export default UsageSection;
