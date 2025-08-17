import { isEqual } from "lodash-es";
import { EyeIcon, EyeOffIcon } from "lucide-react";
import { observer } from "mobx-react-lite";
import { useState } from "react";
import { toast } from "react-hot-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { workspaceStore } from "@/store";
import { workspaceSettingNamePrefix } from "@/store/common";
import { WorkspaceSetting_AiSetting, WorkspaceSetting_Key } from "@/types/proto/api/v1/workspace_service";
import { useTranslate } from "@/utils/i18n";
import TagRecommendationSection from "./TagRecommendationSection";

const AISettings = observer(() => {
  const t = useTranslate();
  const [originalSetting, setOriginalSetting] = useState<WorkspaceSetting_AiSetting>(workspaceStore.state.aiSetting);
  const [aiSetting, setAiSetting] = useState<WorkspaceSetting_AiSetting>(originalSetting);
  const [showApiKey, setShowApiKey] = useState(false);

  const updatePartialSetting = (partial: Partial<WorkspaceSetting_AiSetting>) => {
    setAiSetting(WorkspaceSetting_AiSetting.fromPartial({ ...aiSetting, ...partial }));
  };

  const saveSetting = async (settingToSave: WorkspaceSetting_AiSetting) => {
    try {
      await workspaceStore.updateWorkspaceSetting({
        name: `${workspaceSettingNamePrefix}${WorkspaceSetting_Key.AI}`,
        aiSetting: settingToSave,
      });
      setOriginalSetting(settingToSave);
      setAiSetting(settingToSave);
      toast.success(t("message.update-succeed"));
    } catch (error: any) {
      console.error(error);
      toast.error(error.response?.data?.message || error.message || t("message.update-failed"));
    }
  };

  const updateEnableAI = async (enabled: boolean) => {
    const newSetting = WorkspaceSetting_AiSetting.fromPartial({ ...aiSetting, enableAi: enabled });
    await saveSetting(newSetting);
  };

  const updateSetting = async () => {
    if (aiSetting.enableAi && (!aiSetting.apiKey || !aiSetting.model)) {
      toast.error(t("setting.ai-section.api-key-model-required"));
      return;
    }

    const settingToSave = WorkspaceSetting_AiSetting.fromPartial({
      ...aiSetting,
      baseUrl: aiSetting.baseUrl || "https://api.openai.com/v1",
      timeoutSeconds: aiSetting.timeoutSeconds || 10,
    });

    await saveSetting(settingToSave);
  };

  const resetSetting = () => setAiSetting(originalSetting);

  // 只比较全局AI配置的变化，不包括子功能配置
  const globalSettingChanged = !isEqual(
    {
      enableAi: originalSetting.enableAi,
      baseUrl: originalSetting.baseUrl,
      apiKey: originalSetting.apiKey,
      model: originalSetting.model,
      timeoutSeconds: originalSetting.timeoutSeconds,
    },
    {
      enableAi: aiSetting.enableAi,
      baseUrl: aiSetting.baseUrl,
      apiKey: aiSetting.apiKey,
      model: aiSetting.model,
      timeoutSeconds: aiSetting.timeoutSeconds,
    },
  );

  const handleTagRecommendationChange = (newSetting: WorkspaceSetting_AiSetting) => {
    setOriginalSetting(newSetting);
    setAiSetting(newSetting);
  };

  return (
    <div className="w-full flex flex-col gap-6 pt-2 pb-4">
      {/* Global AI Settings */}
      <div className="w-full flex flex-col gap-2">
        <div className="w-full flex flex-row justify-between items-center">
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm text-gray-400">{t("setting.ai-section.title")}</span>
            <Badge variant={aiSetting.enableAi ? "default" : "secondary"}>
              {aiSetting.enableAi ? t("common.enabled") : t("common.disabled")}
            </Badge>
          </div>
        </div>
        <p className="text-sm text-gray-500">{t("setting.ai-section.description")}</p>

        <div className="w-full flex flex-col gap-4 mt-4">
          {/* Enable AI Toggle */}
          <div className="w-full flex flex-row justify-between items-center">
            <div className="flex flex-col">
              <Label htmlFor="enable-ai">{t("setting.ai-section.enable-ai")}</Label>
              <span className="text-sm text-gray-500">{t("setting.ai-section.enable-ai-description")}</span>
            </div>
            <Switch id="enable-ai" checked={aiSetting.enableAi} onCheckedChange={updateEnableAI} />
          </div>

          {/* AI Global Configuration Fields */}
          {aiSetting.enableAi && (
            <>
              <div className="w-full flex flex-col gap-2">
                <Label htmlFor="base-url">{t("setting.ai-section.base-url")}</Label>
                <Input
                  id="base-url"
                  type="url"
                  placeholder="https://api.openai.com/v1"
                  value={aiSetting.baseUrl}
                  onChange={(e) => updatePartialSetting({ baseUrl: e.target.value })}
                />
                <span className="text-sm text-gray-500">{t("setting.ai-section.base-url-description")}</span>
              </div>

              <div className="w-full flex flex-col gap-2">
                <Label htmlFor="api-key">{t("setting.ai-section.api-key")}</Label>
                <div className="relative">
                  <Input
                    id="api-key"
                    type="text"
                    placeholder="sk-..."
                    value={aiSetting.apiKey}
                    onChange={(e) => updatePartialSetting({ apiKey: e.target.value })}
                    autoComplete="off"
                    style={
                      showApiKey
                        ? {}
                        : ({
                            WebkitTextSecurity: "disc",
                            fontFamily: "text-security-disc, -webkit-small-control",
                          } as React.CSSProperties)
                    }
                    className="pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-1 top-1 h-7 w-7 p-0"
                    onClick={() => setShowApiKey(!showApiKey)}
                  >
                    {showApiKey ? <EyeOffIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
                  </Button>
                </div>
                <span className="text-sm text-gray-500">{t("setting.ai-section.api-key-description")}</span>
              </div>

              <div className="w-full flex flex-col gap-2">
                <Label htmlFor="model">{t("setting.ai-section.model")}</Label>
                <Input
                  id="model"
                  type="text"
                  placeholder="gpt-4o, claude-3-5-sonnet-20241022..."
                  value={aiSetting.model}
                  onChange={(e) => updatePartialSetting({ model: e.target.value })}
                />
                <span className="text-sm text-gray-500">{t("setting.ai-section.model-description")}</span>
              </div>

              <div className="w-full flex flex-col gap-2">
                <Label htmlFor="timeout">{t("setting.ai-section.timeout")}</Label>
                <Input
                  id="timeout"
                  type="number"
                  min="5"
                  max="60"
                  placeholder="10"
                  value={aiSetting.timeoutSeconds}
                  onChange={(e) => updatePartialSetting({ timeoutSeconds: parseInt(e.target.value) || 10 })}
                />
                <span className="text-sm text-gray-500">{t("setting.ai-section.timeout-description")}</span>
              </div>
            </>
          )}
        </div>

        {/* Action Buttons */}
        {aiSetting.enableAi && (
          <div className="w-full flex flex-row justify-end items-center gap-2 mt-4">
            <Button variant="outline" onClick={resetSetting} disabled={!globalSettingChanged}>
              {t("common.cancel")}
            </Button>
            <Button onClick={updateSetting} disabled={!globalSettingChanged}>
              {t("common.save")}
            </Button>
          </div>
        )}
      </div>

      {/* AI Features Section */}
      {aiSetting.enableAi && (
        <>
          <Separator />
          <div className="w-full flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm text-gray-400">{t("setting.ai-features")}</span>
            </div>

            <TagRecommendationSection
              aiSetting={workspaceStore.state.aiSetting}
              onSettingChange={handleTagRecommendationChange}
              disabled={!aiSetting.enableAi}
            />
          </div>
        </>
      )}
    </div>
  );
});

export default AISettings;
