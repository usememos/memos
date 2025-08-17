import { isEqual } from "lodash-es";
import { observer } from "mobx-react-lite";
import { useState, useEffect } from "react";
import { toast } from "react-hot-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { workspaceServiceClient } from "@/grpcweb";
import { workspaceStore } from "@/store";
import { workspaceSettingNamePrefix } from "@/store/common";
import {
  WorkspaceSetting_AiSetting,
  WorkspaceSetting_Key,
  WorkspaceSetting_TagRecommendationConfig,
} from "@/types/proto/api/v1/workspace_service";
import { useTranslate } from "@/utils/i18n";

interface Props {
  aiSetting: WorkspaceSetting_AiSetting;
  onSettingChange: (newSetting: WorkspaceSetting_AiSetting) => void;
  disabled?: boolean;
}

const TagRecommendationSection = observer(({ aiSetting, onSettingChange, disabled = false }: Props) => {
  const t = useTranslate();
  const [originalTagConfig, setOriginalTagConfig] = useState<WorkspaceSetting_TagRecommendationConfig>(
    aiSetting.tagRecommendation ||
      WorkspaceSetting_TagRecommendationConfig.fromPartial({
        enabled: false,
        systemPrompt: "",
        requestsPerMinute: 10,
      }),
  );
  const [tagConfig, setTagConfig] = useState<WorkspaceSetting_TagRecommendationConfig>(originalTagConfig);
  const [defaultPrompt, setDefaultPrompt] = useState<string>("");

  // Sync local state when aiSetting changes
  useEffect(() => {
    const newTagConfig =
      aiSetting.tagRecommendation ||
      WorkspaceSetting_TagRecommendationConfig.fromPartial({
        enabled: false,
        systemPrompt: "",
        requestsPerMinute: 10,
      });
    
    setOriginalTagConfig(newTagConfig);
    setTagConfig(newTagConfig);
  }, [aiSetting]);

  // Fetch default system prompt on component mount
  useEffect(() => {
    const fetchDefaultPrompt = async () => {
      try {
        const response = await workspaceServiceClient.getDefaultTagRecommendationPrompt({});
        setDefaultPrompt(response.systemPrompt);
      } catch (error) {
        console.error("Failed to fetch default system prompt:", error);
      }
    };
    fetchDefaultPrompt();
  }, []);

  const updateTagRecommendation = async (enabled: boolean) => {
    const newTagConfig = WorkspaceSetting_TagRecommendationConfig.fromPartial({
      ...tagConfig,
      enabled,
    });

    const newAiSetting = WorkspaceSetting_AiSetting.fromPartial({
      ...aiSetting,
      tagRecommendation: newTagConfig,
    });

    try {
      await workspaceStore.updateWorkspaceSetting({
        name: `${workspaceSettingNamePrefix}${WorkspaceSetting_Key.AI}`,
        aiSetting: newAiSetting,
      });
      
      setOriginalTagConfig(newTagConfig);
      setTagConfig(newTagConfig);
      onSettingChange(newAiSetting);
      toast.success(t("message.update-succeed"));
    } catch (error: any) {
      console.error(error);
      toast.error(error.response?.data?.message || error.message || t("message.update-failed"));
    }
  };

  const updateTagConfig = (partial: Partial<WorkspaceSetting_TagRecommendationConfig>) => {
    setTagConfig(WorkspaceSetting_TagRecommendationConfig.fromPartial({ ...tagConfig, ...partial }));
  };

  const saveTagConfig = async () => {
    const newAiSetting = WorkspaceSetting_AiSetting.fromPartial({
      ...aiSetting,
      tagRecommendation: tagConfig,
    });

    try {
      await workspaceStore.updateWorkspaceSetting({
        name: `${workspaceSettingNamePrefix}${WorkspaceSetting_Key.AI}`,
        aiSetting: newAiSetting,
      });
      setOriginalTagConfig(tagConfig);
      onSettingChange(newAiSetting);
      toast.success(t("message.update-succeed"));
    } catch (error: any) {
      console.error(error);
      toast.error(error.response?.data?.message || error.message || t("message.update-failed"));
    }
  };

  const resetTagConfig = () => setTagConfig(originalTagConfig);
  const hasChanged = !isEqual(originalTagConfig, tagConfig);

  return (
    <div className="w-full flex flex-col gap-4 p-4 border rounded-md bg-muted/50">
      <div className="w-full flex flex-row justify-between items-center">
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm text-gray-600">{t("setting.tag-recommendation.title")}</span>
          <Badge variant={tagConfig.enabled ? "default" : "secondary"}>
            {tagConfig.enabled ? t("common.enabled") : t("common.disabled")}
          </Badge>
        </div>
      </div>

      <p className="text-sm text-gray-500">{t("setting.tag-recommendation.description")}</p>

      <div className="w-full flex flex-col gap-4">
        {/* Enable Tag Recommendation Toggle */}
        <div className="w-full flex flex-row justify-between items-center">
          <div className="flex flex-col">
            <Label htmlFor="enable-tag-recommendation">{t("setting.tag-recommendation.enable")}</Label>
            <span className="text-sm text-gray-500">{t("setting.tag-recommendation.enable-description")}</span>
          </div>
          <Switch
            id="enable-tag-recommendation"
            checked={tagConfig.enabled}
            onCheckedChange={updateTagRecommendation}
            disabled={disabled}
          />
        </div>

        {/* Tag Recommendation Configuration Fields */}
        {tagConfig.enabled && !disabled && (
          <>
            <div className="w-full flex flex-col gap-2">
              <Label htmlFor="system-prompt">{t("setting.tag-recommendation.system-prompt")}</Label>
              <Textarea
                id="system-prompt"
                placeholder={defaultPrompt || t("setting.tag-recommendation.system-prompt-placeholder")}
                value={tagConfig.systemPrompt}
                onChange={(e) => updateTagConfig({ systemPrompt: e.target.value })}
                className="min-h-[100px]"
              />
              <span className="text-sm text-gray-500">{t("setting.tag-recommendation.system-prompt-description")}</span>
            </div>

            <div className="w-full flex flex-col gap-2">
              <Label htmlFor="rate-limit">{t("setting.tag-recommendation.rate-limit")}</Label>
              <Input
                id="rate-limit"
                type="number"
                min="1"
                max="100"
                placeholder="10"
                value={tagConfig.requestsPerMinute}
                onChange={(e) => updateTagConfig({ requestsPerMinute: parseInt(e.target.value) || 10 })}
              />
              <span className="text-sm text-gray-500">{t("setting.tag-recommendation.rate-limit-description")}</span>
            </div>
          </>
        )}
      </div>

      {/* Action Buttons */}
      {tagConfig.enabled && !disabled && (
        <div className="w-full flex flex-row justify-end items-center gap-2 mt-4">
          <Button variant="outline" onClick={resetTagConfig} disabled={!hasChanged}>
            {t("common.cancel")}
          </Button>
          <Button onClick={saveTagConfig} disabled={!hasChanged}>
            {t("common.save")}
          </Button>
        </div>
      )}
    </div>
  );
});

export default TagRecommendationSection;
