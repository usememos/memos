import { create } from "@bufbuild/protobuf";
import { isEqual, uniq } from "lodash-es";
import { CheckIcon, X } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useInstance } from "@/contexts/InstanceContext";
import {
  InstanceSetting_Key,
  InstanceSetting_MemoRelatedSetting,
  InstanceSetting_MemoRelatedSettingSchema,
  InstanceSettingSchema,
} from "@/types/proto/api/v1/instance_service_pb";
import { useTranslate } from "@/utils/i18n";
import SettingGroup from "./SettingGroup";
import { SettingList, SettingListItem, SettingPanel } from "./SettingList";
import SettingSection from "./SettingSection";
import useInstanceSettingUpdater, { buildInstanceSettingName } from "./useInstanceSettingUpdater";

const MemoRelatedSettings = () => {
  const t = useTranslate();
  const saveInstanceSetting = useInstanceSettingUpdater();
  const { memoRelatedSetting: originalSetting } = useInstance();
  const [memoRelatedSetting, setMemoRelatedSetting] = useState<InstanceSetting_MemoRelatedSetting>(originalSetting);
  const [editingReaction, setEditingReaction] = useState<string>("");

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
      toast.error(t("setting.memo.reactions-required"));
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
      <SettingGroup title={t("setting.memo.editing-title")} description={t("setting.memo.editing-description")}>
        <SettingList>
          <SettingListItem
            label={t("setting.system.enable-double-click-to-edit")}
            description={t("setting.memo.double-click-edit-description")}
          >
            <Switch
              checked={memoRelatedSetting.enableDoubleClickEdit}
              onCheckedChange={(checked) => updatePartialSetting({ enableDoubleClickEdit: checked })}
            />
          </SettingListItem>

          <SettingListItem label={t("setting.memo.content-length-limit")} description={t("setting.memo.content-length-limit-description")}>
            <div className="flex items-center gap-2">
              <Input
                className="w-28 font-mono"
                type="number"
                min={0}
                value={memoRelatedSetting.contentLengthLimit}
                onChange={(event) => updatePartialSetting({ contentLengthLimit: Number(event.target.value) })}
              />
              <span className="text-xs text-muted-foreground">{t("setting.memo.bytes-unit")}</span>
            </div>
          </SettingListItem>
        </SettingList>
      </SettingGroup>

      <SettingGroup title={t("setting.memo.reactions")} description={t("setting.memo.reactions-description")} showSeparator>
        <SettingPanel
          header={
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-medium text-muted-foreground">{t("setting.memo.configured-reactions")}</span>
              <Badge variant="outline" className="rounded-md px-2 py-0 text-xs font-normal">
                {memoRelatedSetting.reactions.length}
              </Badge>
            </div>
          }
          footer={
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Input
                className="h-8 max-w-48 font-mono"
                placeholder={t("setting.memo.reaction-placeholder")}
                value={editingReaction}
                onChange={(event) => setEditingReaction(event.target.value)}
                onKeyDown={(e) => e.key === "Enter" && upsertReaction()}
              />
              <Button variant="outline" size="sm" onClick={upsertReaction} disabled={!editingReaction.trim()}>
                <CheckIcon className="w-4 h-4 mr-1.5" />
                {t("setting.memo.add-reaction")}
              </Button>
            </div>
          }
        >
          <div className="flex min-h-16 flex-wrap gap-2 px-3 py-3">
            {memoRelatedSetting.reactions.map((reactionType) => (
              <Badge key={reactionType} variant="outline" className="flex h-8 items-center gap-2 rounded-md px-2.5 font-normal">
                <span>{reactionType}</span>
                <button
                  type="button"
                  className="text-muted-foreground transition-colors hover:text-destructive"
                  onClick={() => updatePartialSetting({ reactions: memoRelatedSetting.reactions.filter((r) => r !== reactionType) })}
                  aria-label={t("setting.memo.remove-reaction")}
                >
                  <X className="size-3.5" />
                </button>
              </Badge>
            ))}
          </div>
        </SettingPanel>
      </SettingGroup>

      <div className="w-full flex justify-end">
        <Button disabled={isEqual(memoRelatedSetting, originalSetting)} onClick={handleUpdateSetting}>
          {t("common.save")}
        </Button>
      </div>
    </SettingSection>
  );
};

export default MemoRelatedSettings;
