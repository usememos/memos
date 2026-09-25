import { PlusIcon, Trash2Icon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  type AIAssistantConfig,
  type AIAssistantProfile,
  type AIContextScope,
  clampContextCount,
  DEFAULT_ASSISTANT_ID,
  loadAIAssistantConfig,
  MAX_CONTEXT_COUNT,
  newAssistantProfile,
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
 * AI 卡片助手的个人配置：一个共享的接口配置 + 一张助手列表。
 * 列表里 matchTag 为空的那个是默认助手；其余助手按标签路由。
 * 配置只进 localStorage：它是个人实例的单浏览器偏好，不经过服务器。
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

  const updateAssistant = (id: string, patch: Partial<AIAssistantProfile>) => {
    update({ assistants: config.assistants.map((a) => (a.id === id ? { ...a, ...patch } : a)) });
  };

  const addAssistant = () => {
    update({ assistants: [...config.assistants, newAssistantProfile()] });
  };

  const removeAssistant = (id: string) => {
    update({ assistants: config.assistants.filter((a) => a.id !== id) });
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
        </SettingList>
      </SettingGroup>

      <SettingGroup
        title={t("setting.ai-assistant.assistants")}
        description={t("setting.ai-assistant.prompt-note")}
        actions={
          <Button variant="outline" size="sm" onClick={addAssistant}>
            <PlusIcon className="size-4" strokeWidth={1.8} />
            {t("setting.ai-assistant.add-assistant")}
          </Button>
        }
      >
        <div className="flex flex-col gap-3">
          {config.assistants.map((assistant) => {
            const isDefault = assistant.id === DEFAULT_ASSISTANT_ID;
            return (
              <div key={assistant.id} className="flex flex-col gap-3 rounded-lg border border-border p-3">
                <div className="flex items-center gap-2">
                  <Input
                    value={assistant.name}
                    onChange={(event) => updateAssistant(assistant.id, { name: event.target.value })}
                    placeholder={t("setting.ai-assistant.assistant-name-placeholder")}
                    aria-label={t("setting.ai-assistant.assistant-name")}
                    className="max-w-56"
                  />
                  {isDefault && (
                    <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-2xs font-medium text-primary">
                      {t("setting.ai-assistant.default-assistant")}
                    </span>
                  )}
                  <div className="ms-auto flex items-center gap-1">
                    <Switch
                      checked={assistant.enabled}
                      onCheckedChange={(checked) => updateAssistant(assistant.id, { enabled: checked })}
                      aria-label={t("setting.ai-assistant.enable")}
                    />
                    {!isDefault && (
                      <Button
                        variant="quiet"
                        size="icon-sm"
                        onClick={() => removeAssistant(assistant.id)}
                        aria-label={t("setting.ai-assistant.delete-assistant")}
                      >
                        <Trash2Icon className="size-4" strokeWidth={1.8} />
                      </Button>
                    )}
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <Label className="text-xs text-muted-foreground">{t("setting.ai-assistant.match-tag")}</Label>
                  {isDefault ? (
                    <p className="text-xs leading-5 text-muted-foreground">{t("setting.ai-assistant.default-assistant-note")}</p>
                  ) : (
                    <Input
                      value={assistant.matchTag}
                      onChange={(event) => updateAssistant(assistant.id, { matchTag: event.target.value })}
                      placeholder={t("setting.ai-assistant.match-tag-placeholder")}
                      className="max-w-56"
                    />
                  )}
                </div>

                <div className="flex flex-col gap-1">
                  <Label className="text-xs text-muted-foreground">{t("setting.ai-assistant.prompt")}</Label>
                  <Textarea
                    rows={4}
                    value={assistant.prompt}
                    onChange={(event) => updateAssistant(assistant.id, { prompt: event.target.value })}
                    placeholder={t("setting.ai-assistant.default-prompt")}
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <Label className="text-xs text-muted-foreground">{t("setting.ai-assistant.context")}</Label>
                  <RadioGroup
                    value={assistant.contextScope}
                    onValueChange={(value) => updateAssistant(assistant.id, { contextScope: value as AIContextScope })}
                    className="flex flex-col gap-2"
                  >
                    {SCOPE_OPTIONS.map((option) => (
                      <div key={option.value} className="flex items-center gap-2">
                        <RadioGroupItem value={option.value} id={`ai-assistant-${assistant.id}-scope-${option.value}`} />
                        <Label htmlFor={`ai-assistant-${assistant.id}-scope-${option.value}`} className="cursor-pointer font-normal">
                          {t(option.labelKey)}
                        </Label>
                      </div>
                    ))}
                  </RadioGroup>
                </div>

                {assistant.contextScope !== "self" && (
                  <div className="flex items-center gap-2">
                    <Label htmlFor={`ai-assistant-${assistant.id}-count`} className="text-xs text-muted-foreground">
                      {t("setting.ai-assistant.context-count")}
                    </Label>
                    <Input
                      id={`ai-assistant-${assistant.id}-count`}
                      type="number"
                      min={1}
                      max={MAX_CONTEXT_COUNT}
                      className="w-24"
                      value={assistant.contextCount}
                      onChange={(event) => updateAssistant(assistant.id, { contextCount: clampContextCount(Number(event.target.value)) })}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </SettingGroup>
    </SettingSection>
  );
};

export default AIAssistantSection;
