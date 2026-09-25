import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  type AIAssistantConfig,
  type AIContextScope,
  clampContextCount,
  loadAIAssistantConfig,
  MAX_CONTEXT_COUNT,
  saveAIAssistantConfig,
} from "@/lib/ai-assistant";
import { useTranslate } from "@/utils/i18n";
import SettingGroup from "./SettingGroup";
import { SettingList, SettingListItem } from "./SettingList";
import SettingSection from "./SettingSection";

const SCOPE_OPTIONS: {
  value: AIContextScope;
  labelKey: "setting.ai-assistant.context-self" | "setting.ai-assistant.context-recent" | "setting.ai-assistant.context-tag";
}[] = [
  { value: "self", labelKey: "setting.ai-assistant.context-self" },
  { value: "recent", labelKey: "setting.ai-assistant.context-recent" },
  { value: "tag", labelKey: "setting.ai-assistant.context-tag" },
];

/**
 * AI 卡片助手的个人配置。配置只进 localStorage：它是个人实例的单浏览器偏好，
 * 不配进实例设置，也不经过服务器。
 */
const AIAssistantSection = () => {
  const t = useTranslate();
  const [config, setConfig] = useState<AIAssistantConfig>(loadAIAssistantConfig);

  const update = (patch: Partial<AIAssistantConfig>) => {
    setConfig((prev) => {
      const next = { ...prev, ...patch };
      saveAIAssistantConfig(next);
      return next;
    });
  };

  return (
    <SettingSection title={t("setting.ai-assistant.label")} description={t("setting.ai-assistant.storage-note")}>
      <SettingGroup>
        <SettingList>
          <SettingListItem label={t("setting.ai-assistant.enable")}>
            <Switch checked={config.enabled} onCheckedChange={(checked) => update({ enabled: checked })} />
          </SettingListItem>

          <SettingListItem label={t("setting.ai-assistant.base-url")} vertical>
            <Input
              value={config.baseUrl}
              onChange={(event) => update({ baseUrl: event.target.value })}
              placeholder={t("setting.ai-assistant.base-url-placeholder")}
              autoComplete="off"
            />
          </SettingListItem>

          <SettingListItem label={t("setting.ai-assistant.api-key")} vertical>
            <Input
              type="password"
              value={config.apiKey}
              onChange={(event) => update({ apiKey: event.target.value })}
              placeholder="sk-..."
              autoComplete="off"
            />
          </SettingListItem>

          <SettingListItem label={t("setting.ai-assistant.model")} vertical>
            <Input
              value={config.model}
              onChange={(event) => update({ model: event.target.value })}
              placeholder={t("setting.ai-assistant.model-placeholder")}
              autoComplete="off"
            />
          </SettingListItem>

          <SettingListItem label={t("setting.ai-assistant.prompt")} description={t("setting.ai-assistant.prompt-note")} vertical>
            <Textarea
              rows={6}
              value={config.prompt}
              onChange={(event) => update({ prompt: event.target.value })}
              placeholder={t("setting.ai-assistant.default-prompt")}
            />
          </SettingListItem>

          <SettingListItem label={t("setting.ai-assistant.context")} vertical>
            <RadioGroup
              value={config.contextScope}
              onValueChange={(value) => update({ contextScope: value as AIContextScope })}
              className="flex flex-col gap-2"
            >
              {SCOPE_OPTIONS.map((option) => (
                <div key={option.value} className="flex items-center gap-2">
                  <RadioGroupItem value={option.value} id={`ai-assistant-context-${option.value}`} />
                  <Label htmlFor={`ai-assistant-context-${option.value}`} className="cursor-pointer font-normal">
                    {t(option.labelKey)}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </SettingListItem>

          {config.contextScope !== "self" && (
            <SettingListItem label={t("setting.ai-assistant.context-count")} description={t("setting.ai-assistant.context-count-note")}>
              <Input
                type="number"
                min={1}
                max={MAX_CONTEXT_COUNT}
                className="w-24"
                value={config.contextCount}
                onChange={(event) => update({ contextCount: clampContextCount(Number(event.target.value)) })}
              />
            </SettingListItem>
          )}
        </SettingList>
      </SettingGroup>
    </SettingSection>
  );
};

export default AIAssistantSection;
