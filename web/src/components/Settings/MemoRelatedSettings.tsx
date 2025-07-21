import { isEqual, uniq } from "lodash-es";
import { CheckIcon, X } from "lucide-react";
import { observer } from "mobx-react-lite";
import { useState } from "react";
import { toast } from "react-hot-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { workspaceStore } from "@/store";
import { workspaceSettingNamePrefix } from "@/store/common";
import { WorkspaceSettingKey } from "@/store/workspace";
import { WorkspaceMemoRelatedSetting } from "@/types/proto/api/v1/workspace_service";
import { useTranslate } from "@/utils/i18n";

const MemoRelatedSettings = observer(() => {
  const t = useTranslate();
  const [originalSetting, setOriginalSetting] = useState<WorkspaceMemoRelatedSetting>(workspaceStore.state.memoRelatedSetting);
  const [memoRelatedSetting, setMemoRelatedSetting] = useState<WorkspaceMemoRelatedSetting>(originalSetting);
  const [editingReaction, setEditingReaction] = useState<string>("");
  const [editingNsfwTag, setEditingNsfwTag] = useState<string>("");

  const updatePartialSetting = (partial: Partial<WorkspaceMemoRelatedSetting>) => {
    const newWorkspaceMemoRelatedSetting = WorkspaceMemoRelatedSetting.fromPartial({
      ...memoRelatedSetting,
      ...partial,
    });
    setMemoRelatedSetting(newWorkspaceMemoRelatedSetting);
  };

  const upsertReaction = () => {
    if (!editingReaction) {
      return;
    }

    updatePartialSetting({ reactions: uniq([...memoRelatedSetting.reactions, editingReaction.trim()]) });
    setEditingReaction("");
  };

  const upsertNsfwTags = () => {
    if (!editingNsfwTag) {
      return;
    }

    updatePartialSetting({ nsfwTags: uniq([...memoRelatedSetting.nsfwTags, editingNsfwTag.trim()]) });
    setEditingNsfwTag("");
  };

  const updateSetting = async () => {
    if (memoRelatedSetting.reactions.length === 0) {
      toast.error("Reactions must not be empty.");
      return;
    }

    try {
      await workspaceStore.upsertWorkspaceSetting({
        name: `${workspaceSettingNamePrefix}${WorkspaceSettingKey.MEMO_RELATED}`,
        memoRelatedSetting,
      });
      setOriginalSetting(memoRelatedSetting);
      toast.success(t("message.update-succeed"));
    } catch (error: any) {
      toast.error(error.details);
      console.error(error);
    }
  };

  return (
    <div className="w-full flex flex-col gap-2 pt-2 pb-4">
      <p className="font-medium text-muted-foreground">{t("setting.memo-related-settings.title")}</p>
      <div className="w-full flex flex-row justify-between items-center">
        <span>{t("setting.system-section.disable-public-memos")}</span>
        <Switch
          checked={memoRelatedSetting.disallowPublicVisibility}
          onCheckedChange={(checked) => updatePartialSetting({ disallowPublicVisibility: checked })}
        />
      </div>
      <div className="w-full flex flex-row justify-between items-center">
        <span>{t("setting.system-section.display-with-updated-time")}</span>
        <Switch
          checked={memoRelatedSetting.displayWithUpdateTime}
          onCheckedChange={(checked) => updatePartialSetting({ displayWithUpdateTime: checked })}
        />
      </div>
      <div className="w-full flex flex-row justify-between items-center">
        <span>{t("setting.memo-related-settings.enable-link-preview")}</span>
        <Switch
          checked={memoRelatedSetting.enableLinkPreview}
          onCheckedChange={(checked) => updatePartialSetting({ enableLinkPreview: checked })}
        />
      </div>
      <div className="w-full flex flex-row justify-between items-center">
        <span>{t("setting.memo-related-settings.enable-memo-comments")}</span>
        <Switch
          checked={memoRelatedSetting.enableComment}
          onCheckedChange={(checked) => updatePartialSetting({ enableComment: checked })}
        />
      </div>
      <div className="w-full flex flex-row justify-between items-center">
        <span>{t("setting.system-section.enable-double-click-to-edit")}</span>
        <Switch
          checked={memoRelatedSetting.enableDoubleClickEdit}
          onCheckedChange={(checked) => updatePartialSetting({ enableDoubleClickEdit: checked })}
        />
      </div>
      <div className="w-full flex flex-row justify-between items-center">
        <span>{t("setting.system-section.disable-markdown-shortcuts-in-editor")}</span>
        <Switch
          checked={memoRelatedSetting.disableMarkdownShortcuts}
          onCheckedChange={(checked) => updatePartialSetting({ disableMarkdownShortcuts: checked })}
        />
      </div>
      <div className="w-full flex flex-row justify-between items-center">
        <span>{t("setting.memo-related-settings.content-lenght-limit")}</span>
        <Input
          className="w-24"
          type="number"
          defaultValue={memoRelatedSetting.contentLengthLimit}
          onBlur={(event) => updatePartialSetting({ contentLengthLimit: Number(event.target.value) })}
        />
      </div>
      <div className="w-full">
        <span className="truncate">{t("setting.memo-related-settings.reactions")}</span>
        <div className="mt-2 w-full flex flex-row flex-wrap gap-1">
          {memoRelatedSetting.reactions.map((reactionType) => {
            return (
              <Badge key={reactionType} variant="outline" className="flex items-center gap-1">
                {reactionType}
                <X
                  className="w-3 h-3 cursor-pointer hover:text-destructive"
                  onClick={() => updatePartialSetting({ reactions: memoRelatedSetting.reactions.filter((r) => r !== reactionType) })}
                />
              </Badge>
            );
          })}
          <div className="flex items-center gap-1">
            <Input
              className="w-32"
              placeholder={t("common.input")}
              value={editingReaction}
              onChange={(event) => setEditingReaction(event.target.value.trim())}
            />
            <CheckIcon className="w-5 h-5 text-muted-foreground cursor-pointer hover:text-primary" onClick={() => upsertReaction()} />
          </div>
        </div>
      </div>
      <div className="w-full">
        <div className="w-full flex flex-row justify-between items-center">
          <span>{t("setting.memo-related-settings.enable-blur-nsfw-content")}</span>
          <Switch
            checked={memoRelatedSetting.enableBlurNsfwContent}
            onCheckedChange={(checked) => updatePartialSetting({ enableBlurNsfwContent: checked })}
          />
        </div>
        <div className="mt-2 w-full flex flex-row flex-wrap gap-1">
          {memoRelatedSetting.nsfwTags.map((nsfwTag) => {
            return (
              <Badge key={nsfwTag} variant="outline" className="flex items-center gap-1">
                {nsfwTag}
                <X
                  className="w-3 h-3 cursor-pointer hover:text-destructive"
                  onClick={() => updatePartialSetting({ nsfwTags: memoRelatedSetting.nsfwTags.filter((r) => r !== nsfwTag) })}
                />
              </Badge>
            );
          })}
          <div className="flex items-center gap-1">
            <Input
              className="w-32"
              placeholder={t("common.input")}
              value={editingNsfwTag}
              onChange={(event) => setEditingNsfwTag(event.target.value.trim())}
            />
            <CheckIcon className="w-5 h-5 text-muted-foreground cursor-pointer hover:text-primary" onClick={() => upsertNsfwTags()} />
          </div>
        </div>
      </div>
      <div className="mt-2 w-full flex justify-end">
        <Button disabled={isEqual(memoRelatedSetting, originalSetting)} onClick={updateSetting}>
          {t("common.save")}
        </Button>
      </div>
    </div>
  );
});

export default MemoRelatedSettings;
