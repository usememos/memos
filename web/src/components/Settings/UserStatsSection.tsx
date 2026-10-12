import useCurrentUser from "@/hooks/useCurrentUser";
import { useUserStats } from "@/hooks/useUserQueries";
import { formatFileSize } from "@/utils/format";
import { useTranslate } from "@/utils/i18n";
import SettingGroup from "./SettingGroup";
import { SettingList, StatRow } from "./SettingList";

const UserStatsSection = () => {
  const t = useTranslate();
  const user = useCurrentUser();
  const { data, isError } = useUserStats(user?.name);

  if (!user) return null;

  const storage = data?.attachmentStorageBytes;
  return (
    <SettingGroup showSeparator title={t("common.statistics")}>
      {isError ? (
        <p className="text-sm text-muted-foreground" role="status">
          {t("setting.account.storage-usage-error")}
        </p>
      ) : (
        <SettingList>
          <StatRow label={t("setting.account.attachment-storage")} value={storage === undefined ? "…" : formatFileSize(Number(storage))} />
        </SettingList>
      )}
    </SettingGroup>
  );
};

export default UserStatsSection;
