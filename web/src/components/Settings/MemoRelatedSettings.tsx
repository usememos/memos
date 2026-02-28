import { create } from "@bufbuild/protobuf";
import { isEqual, uniq } from "lodash-es";
import { CheckIcon, X } from "lucide-react";
import { useState } from "react";
import { toast } from "react-hot-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useInstance } from "@/contexts/InstanceContext";
import { handleError } from "@/lib/error";
import {
  InstanceSetting_Key,
  InstanceSetting_MemoRelatedSetting,
  InstanceSetting_MemoRelatedSettingSchema,
  InstanceSettingSchema,
} from "@/types/proto/api/v1/instance_service_pb";
import { useTranslate } from "@/utils/i18n";
import SettingGroup from "./SettingGroup";
import SettingRow from "./SettingRow";
import SettingSection from "./SettingSection";

const MemoRelatedSettings = () => {
  const t = useTranslate();
  const { memoRelatedSetting: originalSetting, updateSetting, fetchSetting } = useInstance();
  const [memoRelatedSetting, setMemoRelatedSetting] = useState<InstanceSetting_MemoRelatedSetting>(originalSetting);
  const [editingReaction, setEditingReaction] = useState<string>("");

  const updatePartialSetting = (partial: Partial<InstanceSetting_MemoRelatedSetting>) => {
    const newInstanceMemoRelatedSetting = create(InstanceSetting_MemoRelatedSettingSchema, {
      ...memoRelatedSetting,
      ...partial,
    });
    setMemoRelatedSetting(newInstanceMemoRelatedSetting);
  };

  const upsertReaction = () => {
    if (!editingReaction) {
      return;
    }

    updatePartialSetting({ reactions: uniq([...memoRelatedSetting.reactions, editingReaction.trim()]) });
    setEditingReaction("");
  };

  const handleUpdateSetting = async () => {
    if (memoRelatedSetting.reactions.length === 0) {
      toast.error("Reactions must not be empty.");
      return;
    }

    try {
      await updateSetting(
        create(InstanceSettingSchema, {
          name: `instance/settings/${InstanceSetting_Key[InstanceSetting_Key.MEMO_RELATED]}`,
          value: {
            case: "memoRelatedSetting",
            value: memoRelatedSetting,
          },
        }),
      );
      await fetchSetting(InstanceSetting_Key.MEMO_RELATED);
      toast.success(t("message.update-succeed"));
    } catch (error: unknown) {
      await handleError(error, toast.error, {
        context: "Update memo-related settings",
      });
    }
  };

  return (
    <SettingSection>
      <SettingGroup title={t("setting.memo-related-settings.title")}>
        <SettingRow label={t("setting.system-section.disable-public-memos")}>
          <Switch
            checked={memoRelatedSetting.disallowPublicVisibility}
            onCheckedChange={(checked) => updatePartialSetting({ disallowPublicVisibility: checked })}
          />
        </SettingRow>

        <SettingRow label={t("setting.system-section.display-with-updated-time")}>
          <Switch
            checked={memoRelatedSetting.displayWithUpdateTime}
            onCheckedChange={(checked) => updatePartialSetting({ displayWithUpdateTime: checked })}
          />
        </SettingRow>

        <SettingRow label={t("setting.system-section.enable-double-click-to-edit")}>
          <Switch
            checked={memoRelatedSetting.enableDoubleClickEdit}
            onCheckedChange={(checked) => updatePartialSetting({ enableDoubleClickEdit: checked })}
          />
        </SettingRow>

        <SettingRow label={t("setting.memo-related-settings.content-length-limit")}>
          <Input
            className="w-24"
            type="number"
            defaultValue={memoRelatedSetting.contentLengthLimit}
            onBlur={(event) => updatePartialSetting({ contentLengthLimit: Number(event.target.value) })}
          />
        </SettingRow>
      </SettingGroup>

      <SettingGroup title={t("setting.memo-related-settings.reactions")} showSeparator>
        <div className="w-full flex flex-row flex-wrap gap-2">
          {memoRelatedSetting.reactions.map((reactionType) => (
            <Badge key={reactionType} variant="outline" className="flex items-center gap-1.5 h-8 px-3">
              {reactionType}
              <span
                className="cursor-pointer text-muted-foreground hover:text-destructive"
                onClick={() => updatePartialSetting({ reactions: memoRelatedSetting.reactions.filter((r) => r !== reactionType) })}
              >
                <X className="w-3.5 h-3.5" />
              </span>
            </Badge>
          ))}
          <div className="flex items-center gap-1.5">
            <Input
              className="w-32 h-8"
              placeholder={t("common.input")}
              value={editingReaction}
              onChange={(event) => setEditingReaction(event.target.value.trim())}
              onKeyDown={(e) => e.key === "Enter" && upsertReaction()}
            />
            <Button variant="ghost" size="sm" onClick={upsertReaction} className="h-8 w-8 p-0">
              <CheckIcon className="w-4 h-4" />
            </Button>
          </div>
        </div>
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
