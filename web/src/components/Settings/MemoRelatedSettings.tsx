import { create } from "@bufbuild/protobuf";
import { Badge, Button, Input, Tooltip } from "@usememos/ui";
import { isEqual, uniq } from "lodash-es";
import { CheckIcon, CircleAlertIcon, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useInstance } from "@/contexts/InstanceContext";
import { isFieldManaged, useManagedResource } from "@/hooks/useConfigurationQueries";
import {
  InstanceSetting_Key,
  InstanceSetting_MemoRelatedSetting,
  InstanceSetting_MemoRelatedSettingSchema,
  InstanceSettingSchema,
} from "@/types/proto/api/instance_service_pb";
import { useTranslate } from "@/utils/i18n";
import ManagedByConfigurationChip from "./ManagedByConfigurationChip";
import SettingGroup from "./SettingGroup";
import { SettingPanel } from "./SettingList";
import SettingSection from "./SettingSection";
import useInstanceSettingUpdater, { buildInstanceSettingName } from "./useInstanceSettingUpdater";

const MemoRelatedSettings = () => {
  const t = useTranslate();
  const saveInstanceSetting = useInstanceSettingUpdater();
  const { memoRelatedSetting: originalSetting } = useInstance();
  const [memoRelatedSetting, setMemoRelatedSetting] = useState<InstanceSetting_MemoRelatedSetting>(originalSetting);
  const [editingReaction, setEditingReaction] = useState<string>("");
  const managed = useManagedResource(buildInstanceSettingName(InstanceSetting_Key.MEMO_RELATED));
  const reactionsLocked = isFieldManaged(managed, "memoRelatedSetting.reactions");

  useEffect(() => {
    setMemoRelatedSetting(originalSetting);
  }, [originalSetting]);

  const updatePartialSetting = (partial: Partial<InstanceSetting_MemoRelatedSetting>) => {
    const newInstanceMemoRelatedSetting = create(InstanceSetting_MemoRelatedSettingSchema, {
      ...memoRelatedSetting,
      ...partial,
    });
    setMemoRelatedSetting(newInstanceMemoRelatedSetting);
  };

  const upsertReaction = () => {
    const trimmed = editingReaction.trim();
    if (!trimmed) {
      return;
    }

    updatePartialSetting({ reactions: uniq([...memoRelatedSetting.reactions, trimmed]) });
    setEditingReaction("");
  };

  const handleUpdateSetting = async () => {
    if (memoRelatedSetting.reactions.length === 0) {
      return;
    }

    await saveInstanceSetting({
      key: InstanceSetting_Key.MEMO_RELATED,
      setting: create(InstanceSettingSchema, {
        name: buildInstanceSettingName(InstanceSetting_Key.MEMO_RELATED),
        value: {
          case: "memoRelatedSetting",
          value: memoRelatedSetting,
        },
      }),
      errorContext: "Update memo-related settings",
    });
  };

  return (
    <SettingSection title={t("setting.memo.label")}>
      <SettingGroup
        title={t("setting.memo.reactions")}
        description={t("setting.memo.reactions-description")}
        actions={reactionsLocked ? <ManagedByConfigurationChip resource={managed} /> : undefined}
      >
        <SettingPanel
          header={
            <div className="flex items-center justify-between gap-3">
              <span className="mu-label text-mu-text-secondary">{t("setting.memo.configured-reactions")}</span>
              <Badge tone="outline">{memoRelatedSetting.reactions.length}</Badge>
            </div>
          }
          footer={
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Input
                className="max-w-48 font-mono"
                aria-label={t("setting.memo.add-reaction")}
                placeholder={t("setting.memo.reaction-placeholder")}
                value={editingReaction}
                disabled={reactionsLocked}
                onChange={(event) => setEditingReaction(event.target.value)}
                onKeyDown={(e) => e.key === "Enter" && upsertReaction()}
              />
              <Button variant="neutral" onClick={upsertReaction} disabled={reactionsLocked || !editingReaction.trim()} icon={<CheckIcon />}>
                {t("setting.memo.add-reaction")}
              </Button>
            </div>
          }
        >
          <div className="flex min-h-10 flex-wrap gap-2">
            {memoRelatedSetting.reactions.map((reactionType) => (
              <span key={reactionType} className="inline-flex h-8 items-center gap-2 rounded-mu-md border border-mu-line px-2.5 mu-body">
                <span>{reactionType}</span>
                <Tooltip.Root>
                  <Tooltip.Trigger
                    render={
                      <Button
                        variant="ghost"
                        size="xs"
                        disabled={reactionsLocked}
                        onClick={() => updatePartialSetting({ reactions: memoRelatedSetting.reactions.filter((r) => r !== reactionType) })}
                        aria-label={t("setting.memo.remove-reaction")}
                        icon={<X />}
                      />
                    }
                  />
                  <Tooltip.Popup>{t("setting.memo.remove-reaction")}</Tooltip.Popup>
                </Tooltip.Root>
              </span>
            ))}
          </div>
        </SettingPanel>
      </SettingGroup>

      <div className="flex w-full items-center justify-end gap-3">
        {memoRelatedSetting.reactions.length === 0 && (
          <p role="alert" className="flex items-center gap-1 mu-caption text-mu-danger">
            <CircleAlertIcon className="mu-icon" />
            {t("setting.memo.reactions-required")}
          </p>
        )}
        <Button
          variant="primary"
          disabled={isEqual(memoRelatedSetting, originalSetting) || memoRelatedSetting.reactions.length === 0}
          onClick={handleUpdateSetting}
        >
          {t("common.save")}
        </Button>
      </div>
    </SettingSection>
  );
};

export default MemoRelatedSettings;
