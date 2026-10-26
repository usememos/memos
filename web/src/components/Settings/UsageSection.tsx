import useCurrentUser from "@/hooks/useCurrentUser";
import { useUserUsage } from "@/hooks/useUserQueries";
import { useTranslate } from "@/utils/i18n";
import SettingGroup from "./SettingGroup";
import { SettingList, StatRow } from "./SettingList";
import { formatLimitValue, isLimited, USAGE_METRICS, type UsageMetric } from "./usageLimitValues";

/**
 * Shows the current user's usage against the limit set in effect for them. It
 * renders nothing when no limit applies, so instances without limits look as
 * before.
 */
const UsageSection = () => {
  const t = useTranslate();
  const user = useCurrentUser();
  const { data: usage } = useUserUsage(user?.name);

  if (!usage?.limits) return null;
  const limits = usage.limits;
  if (!USAGE_METRICS.some((metric) => isLimited(limits[metric]))) return null;

  const of = (metric: UsageMetric, used: bigint) => {
    const limit = limits[metric];
    return isLimited(limit)
      ? t("setting.account.usage-of", { usage: formatLimitValue(metric, used), limit: formatLimitValue(metric, limit) })
      : formatLimitValue(metric, used);
  };

  return (
    <SettingGroup showSeparator title={t("setting.account.usage-title")} description={t("setting.account.usage-description")}>
      <SettingList>
        <StatRow label={t("setting.account.usage-memos")} value={of("memoCount", usage.memoCount)} />
        <StatRow label={t("setting.account.usage-storage")} value={of("storageBytes", usage.storageBytes)} />
        {isLimited(limits.memoContentBytes) && (
          <StatRow
            label={t("setting.usage-limits.content-size-column")}
            value={formatLimitValue("memoContentBytes", limits.memoContentBytes)}
          />
        )}
        {isLimited(limits.uploadBytes) && (
          <StatRow label={t("setting.account.usage-file-size")} value={formatLimitValue("uploadBytes", limits.uploadBytes)} />
        )}
      </SettingList>
    </SettingGroup>
  );
};

export default UsageSection;
