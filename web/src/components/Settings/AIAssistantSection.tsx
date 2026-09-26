import { create } from "@bufbuild/protobuf";
import { PlusIcon, Trash2Icon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "react-hot-toast";
import { v4 as uuidv4 } from "uuid";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useInstance } from "@/contexts/InstanceContext";
import {
  InstanceSetting_AIAssistantConfig,
  InstanceSetting_AIAssistantConfigSchema,
  InstanceSetting_AIAssistantContextScope,
  InstanceSetting_AIProviderConfigSchema,
  InstanceSetting_AISettingSchema,
  InstanceSetting_AssistantsConfigSchema,
  InstanceSetting_Key,
  InstanceSettingSchema,
} from "@/types/proto/api/v1/instance_service_pb";
import { useTranslate } from "@/utils/i18n";
import SettingGroup from "./SettingGroup";
import { SettingList, SettingListItem } from "./SettingList";
import SettingSection from "./SettingSection";
import useInstanceSettingUpdater, { buildInstanceSettingName } from "./useInstanceSettingUpdater";

const MAX_CONTEXT_LIMIT = 50;
const DEFAULT_CONTEXT_LIMIT = 10;

const SCOPE_OPTIONS = [
  { value: InstanceSetting_AIAssistantContextScope.CURRENT_MEMO_ONLY, labelKey: "setting.ai-assistant.context-self" },
  { value: InstanceSetting_AIAssistantContextScope.RECENT_MEMOS, labelKey: "setting.ai-assistant.context-recent" },
  { value: InstanceSetting_AIAssistantContextScope.SAME_TAG_MEMOS, labelKey: "setting.ai-assistant.context-tag" },
] as const;

type LocalAssistant = {
  id: string;
  title: string;
  icon: string;
  prompt: string;
  tags: string;
  providerId: string;
  model: string;
  contextScope: InstanceSetting_AIAssistantContextScope;
  contextLimit: number;
  enabled: boolean;
};

const toLocalAssistant = (assistant: InstanceSetting_AIAssistantConfig): LocalAssistant => ({
  id: assistant.id,
  title: assistant.title,
  icon: assistant.icon,
  prompt: assistant.prompt,
  tags: assistant.tags.join(", "),
  providerId: assistant.providerId,
  model: assistant.model,
  contextScope:
    assistant.contextScope === InstanceSetting_AIAssistantContextScope.AI_ASSISTANT_CONTEXT_SCOPE_UNSPECIFIED
      ? InstanceSetting_AIAssistantContextScope.CURRENT_MEMO_ONLY
      : assistant.contextScope,
  contextLimit: assistant.contextLimit || DEFAULT_CONTEXT_LIMIT,
  enabled: assistant.enabled,
});

const newLocalAssistant = (): LocalAssistant => ({
  id: uuidv4(),
  title: "",
  icon: "",
  prompt: "",
  tags: "",
  providerId: "",
  model: "",
  contextScope: InstanceSetting_AIAssistantContextScope.CURRENT_MEMO_ONLY,
  contextLimit: DEFAULT_CONTEXT_LIMIT,
  enabled: true,
});

const parseTags = (value: string) =>
  value
    .split(/[,，\s]+/)
    .map((tag) => tag.trim().replace(/^#/, ""))
    .filter((tag) => tag.length > 0);

const toAssistantConfig = (assistant: LocalAssistant) =>
  create(InstanceSetting_AIAssistantConfigSchema, {
    id: assistant.id,
    title: assistant.title.trim(),
    icon: assistant.icon.trim(),
    prompt: assistant.prompt,
    tags: parseTags(assistant.tags),
    providerId: assistant.providerId,
    model: assistant.model.trim(),
    contextScope: assistant.contextScope,
    contextLimit: assistant.contextLimit,
    enabled: assistant.enabled,
  });

/**
 * Automatic AI review of new memos.
 *
 * Assistants live in the instance AI setting next to the providers they call,
 * so prompts and routing follow the account rather than one browser, and the
 * review itself runs server-side — including for memos created from the API or
 * a mobile client. The provider list and its API keys are managed in the AI
 * section; this section only references a provider by id.
 */
const AIAssistantSection = () => {
  const t = useTranslate();
  const saveInstanceSetting = useInstanceSettingUpdater();
  const { aiSetting } = useInstance();

  const persistedAssistants = useMemo(() => aiSetting.assistants?.assistants ?? [], [aiSetting.assistants]);
  const [enabled, setEnabled] = useState(() => aiSetting.assistants?.enabled ?? false);
  const [assistants, setAssistants] = useState<LocalAssistant[]>(() => persistedAssistants.map(toLocalAssistant));

  useEffect(() => {
    setEnabled(aiSetting.assistants?.enabled ?? false);
    setAssistants(persistedAssistants.map(toLocalAssistant));
  }, [aiSetting.assistants?.enabled, persistedAssistants]);

  const providers = aiSetting.providers;
  const hasProviders = providers.length > 0;

  // Providers and transcription travel with every AI-setting save, otherwise
  // the server would read this section's payload as "remove them". API keys are
  // write-only, so sending them back empty makes the server keep the stored key.
  const persist = async (nextEnabled: boolean, nextAssistants: LocalAssistant[]) => {
    return saveInstanceSetting({
      key: InstanceSetting_Key.AI,
      setting: create(InstanceSettingSchema, {
        name: buildInstanceSettingName(InstanceSetting_Key.AI),
        value: {
          case: "aiSetting",
          value: create(InstanceSetting_AISettingSchema, {
            providers: providers.map((provider) =>
              create(InstanceSetting_AIProviderConfigSchema, {
                id: provider.id,
                title: provider.title,
                type: provider.type,
                endpoint: provider.endpoint,
              }),
            ),
            transcription: aiSetting.transcription,
            assistants: create(InstanceSetting_AssistantsConfigSchema, {
              enabled: nextEnabled,
              assistants: nextAssistants.map(toAssistantConfig),
            }),
          }),
        },
      }),
      errorContext: "Update AI assistants",
    });
  };

  const updateAssistant = (id: string, patch: Partial<LocalAssistant>) => {
    setAssistants((prev) => prev.map((assistant) => (assistant.id === id ? { ...assistant, ...patch } : assistant)));
  };

  const handleToggleEnabled = async (nextEnabled: boolean) => {
    setEnabled(nextEnabled);
    if (!(await persist(nextEnabled, assistants))) {
      setEnabled(!nextEnabled);
    }
  };

  const handleAddAssistant = () => {
    setAssistants((prev) => [...prev, newLocalAssistant()]);
  };

  const handleRemoveAssistant = async (id: string) => {
    const nextAssistants = assistants.filter((assistant) => assistant.id !== id);
    setAssistants(nextAssistants);
    await persist(enabled, nextAssistants);
  };

  const handleSave = async () => {
    for (const assistant of assistants) {
      if (!assistant.title.trim()) {
        toast.error(t("setting.ai-assistant.title-required"));
        return;
      }
      if (assistant.enabled && !assistant.providerId) {
        toast.error(t("setting.ai-assistant.provider-required"));
        return;
      }
    }
    await persist(enabled, assistants);
  };

  return (
    <SettingSection
      title={t("setting.ai-assistant.label")}
      actions={
        <Button onClick={handleSave} disabled={!hasProviders}>
          {t("common.save")}
        </Button>
      }
    >
      <SettingGroup title={t("setting.ai-assistant.label")} description={t("setting.ai-assistant.description")}>
        <SettingList>
          <SettingListItem label={t("setting.ai-assistant.auto-analyze")} description={t("setting.ai-assistant.auto-analyze-description")}>
            <Switch checked={enabled} disabled={!hasProviders} onCheckedChange={handleToggleEnabled} />
          </SettingListItem>
        </SettingList>
        {!hasProviders && <p className="text-sm text-amber-600 dark:text-amber-500">{t("setting.ai-assistant.no-provider-hint")}</p>}
      </SettingGroup>

      <SettingGroup title={t("setting.ai-assistant.assistants-title")} description={t("setting.ai-assistant.assistants-description")}>
        <div className="flex flex-col gap-4">
          {assistants.map((assistant) => (
            <div key={assistant.id} className="flex flex-col gap-3 rounded-lg border border-border p-4">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Switch checked={assistant.enabled} onCheckedChange={(checked) => updateAssistant(assistant.id, { enabled: checked })} />
                  <span className="text-sm text-muted-foreground">{t("setting.ai-assistant.assistant-enabled")}</span>
                </div>
                <Button variant="ghost" size="sm" onClick={() => handleRemoveAssistant(assistant.id)}>
                  <Trash2Icon className="h-4 w-4 text-destructive" />
                </Button>
              </div>

              <div className="grid gap-3 sm:grid-cols-[6rem_1fr]">
                <div className="flex flex-col gap-1.5">
                  <Label>{t("setting.ai-assistant.icon")}</Label>
                  <Input
                    value={assistant.icon}
                    placeholder="📗"
                    onChange={(e) => updateAssistant(assistant.id, { icon: e.target.value })}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>{t("setting.ai-assistant.assistant-name")}</Label>
                  <Input
                    value={assistant.title}
                    placeholder={t("setting.ai-assistant.assistant-name-placeholder")}
                    onChange={(e) => updateAssistant(assistant.id, { title: e.target.value })}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label>{t("setting.ai-assistant.match-tags")}</Label>
                <Input
                  value={assistant.tags}
                  placeholder={t("setting.ai-assistant.match-tags-placeholder")}
                  onChange={(e) => updateAssistant(assistant.id, { tags: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">{t("setting.ai-assistant.match-tags-description")}</p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <Label>{t("setting.ai-assistant.provider")}</Label>
                  <Select value={assistant.providerId} onValueChange={(value) => updateAssistant(assistant.id, { providerId: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder={t("setting.ai-assistant.provider-placeholder")} />
                    </SelectTrigger>
                    <SelectContent>
                      {providers.map((provider) => (
                        <SelectItem key={provider.id} value={provider.id}>
                          {/* A provider saved without a title would otherwise be an unreadable blank row. */}
                          {provider.title || provider.id}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>{t("setting.ai-assistant.model")}</Label>
                  <Input
                    value={assistant.model}
                    placeholder={t("setting.ai-assistant.model-placeholder")}
                    onChange={(e) => updateAssistant(assistant.id, { model: e.target.value })}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label>{t("setting.ai-assistant.prompt")}</Label>
                <Textarea
                  value={assistant.prompt}
                  rows={5}
                  placeholder={t("setting.ai-assistant.prompt-placeholder")}
                  onChange={(e) => updateAssistant(assistant.id, { prompt: e.target.value })}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label>{t("setting.ai-assistant.context-scope")}</Label>
                <RadioGroup
                  value={String(assistant.contextScope)}
                  onValueChange={(value) =>
                    updateAssistant(assistant.id, { contextScope: Number(value) as InstanceSetting_AIAssistantContextScope })
                  }
                >
                  {SCOPE_OPTIONS.map((option) => (
                    <div key={option.value} className="flex items-center gap-2">
                      <RadioGroupItem value={String(option.value)} id={`${assistant.id}-scope-${option.value}`} />
                      <Label htmlFor={`${assistant.id}-scope-${option.value}`} className="font-normal">
                        {t(option.labelKey)}
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              </div>

              {assistant.contextScope !== InstanceSetting_AIAssistantContextScope.CURRENT_MEMO_ONLY && (
                <div className="flex flex-col gap-1.5">
                  <Label>{t("setting.ai-assistant.context-count")}</Label>
                  <Input
                    type="number"
                    min={1}
                    max={MAX_CONTEXT_LIMIT}
                    value={assistant.contextLimit}
                    onChange={(e) =>
                      updateAssistant(assistant.id, {
                        contextLimit: Math.min(MAX_CONTEXT_LIMIT, Math.max(1, Number(e.target.value) || DEFAULT_CONTEXT_LIMIT)),
                      })
                    }
                  />
                </div>
              )}
            </div>
          ))}

          <Button variant="outline" onClick={handleAddAssistant} disabled={!hasProviders}>
            <PlusIcon className="mr-2 h-4 w-4" />
            {t("setting.ai-assistant.add-assistant")}
          </Button>
        </div>
      </SettingGroup>
    </SettingSection>
  );
};

export default AIAssistantSection;
