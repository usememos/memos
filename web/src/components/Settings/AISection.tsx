import { create } from "@bufbuild/protobuf";
import { isEqual } from "lodash-es";
import { MoreVerticalIcon, PlusIcon, RefreshCwIcon } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "react-hot-toast";
import { v4 as uuidv4 } from "uuid";
import ConfirmDialog from "@/components/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { aiServiceClient } from "@/connect";
import { useInstance } from "@/contexts/InstanceContext";
import {
  AI_PROVIDER_TYPE_OPTIONS,
  DEFAULT_CHAT_CONTEXT_BUDGET_TOKENS,
  getDefaultEndpointPlaceholder,
  getProviderTypeLabel,
  isChatCapableProviderType,
  isTranscriptionCapableProviderType,
} from "@/lib/ai-providers";
import { handleError } from "@/lib/error";
import {
  InstanceSetting_AIProviderConfig,
  InstanceSetting_AIProviderConfigSchema,
  InstanceSetting_AIProviderType,
  InstanceSetting_AISettingSchema,
  InstanceSetting_ChatConfig,
  InstanceSetting_ChatConfigSchema,
  InstanceSetting_Key,
  InstanceSetting_TranscriptionConfig,
  InstanceSetting_TranscriptionConfigSchema,
  InstanceSettingSchema,
} from "@/types/proto/api/v1/instance_service_pb";
import { useTranslate } from "@/utils/i18n";
import SettingGroup from "./SettingGroup";
import { SettingPanel } from "./SettingList";
import SettingSection from "./SettingSection";
import SettingTable from "./SettingTable";
import useInstanceSettingUpdater, { buildInstanceSettingName } from "./useInstanceSettingUpdater";

type LocalAIProvider = {
  id: string;
  title: string;
  type: InstanceSetting_AIProviderType;
  endpoint: string;
  apiKey: string;
  apiKeySet: boolean;
  apiKeyHint: string;
};

type LocalTranscription = {
  providerId: string;
  model: string;
  language: string;
  prompt: string;
};

type LocalChat = {
  providerId: string;
  model: string;
  // Kept as strings because the proto fields are int64 (bigint in TS) and a
  // number input's raw value is text anyway. Converted at the boundaries.
  contextBudgetTokens: string;
  maxCompletionTokens: string;
};

const providerTypeSelectOptions = AI_PROVIDER_TYPE_OPTIONS.map((type) => ({ value: String(type), label: getProviderTypeLabel(type) }));

const byokNotes = ["setting.ai.byok-key-note", "setting.ai.byok-storage-note", "setting.ai.byok-model-note"] as const;

const toLocalProvider = (provider: InstanceSetting_AIProviderConfig): LocalAIProvider => ({
  id: provider.id,
  title: provider.title,
  type: provider.type,
  endpoint: provider.endpoint,
  apiKey: "",
  apiKeySet: provider.apiKeySet,
  apiKeyHint: provider.apiKeyHint,
});

const toLocalTranscription = (config: InstanceSetting_TranscriptionConfig | undefined): LocalTranscription => ({
  providerId: config?.providerId ?? "",
  model: config?.model ?? "",
  language: config?.language ?? "",
  prompt: config?.prompt ?? "",
});

const toLocalChat = (config: InstanceSetting_ChatConfig | undefined): LocalChat => ({
  providerId: config?.providerId ?? "",
  model: config?.model ?? "",
  contextBudgetTokens: config?.contextBudgetTokens ? String(config.contextBudgetTokens) : "",
  maxCompletionTokens: config?.maxCompletionTokens ? String(config.maxCompletionTokens) : "",
});

/** Parses a token-count input into a non-negative int64 value. */
const parseTokenCount = (value: string): bigint => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? BigInt(parsed) : 0n;
};

const newProvider = (): LocalAIProvider => ({
  id: uuidv4(),
  title: "",
  type: InstanceSetting_AIProviderType.OPENAI,
  endpoint: "",
  apiKey: "",
  apiKeySet: false,
  apiKeyHint: "",
});

const toProviderConfig = (provider: LocalAIProvider) =>
  create(InstanceSetting_AIProviderConfigSchema, {
    id: provider.id,
    title: provider.title.trim(),
    type: provider.type,
    endpoint: provider.endpoint.trim(),
    apiKey: provider.apiKey,
  });

const toTranscriptionConfig = (transcription: LocalTranscription) =>
  create(InstanceSetting_TranscriptionConfigSchema, {
    providerId: transcription.providerId,
    model: transcription.model.trim(),
    language: transcription.language.trim(),
    prompt: transcription.prompt,
  });

const toChatConfig = (chat: LocalChat) =>
  create(InstanceSetting_ChatConfigSchema, {
    providerId: chat.providerId,
    model: chat.model.trim(),
    contextBudgetTokens: parseTokenCount(chat.contextBudgetTokens),
    maxCompletionTokens: parseTokenCount(chat.maxCompletionTokens),
  });

const AISection = () => {
  const t = useTranslate();
  const saveInstanceSetting = useInstanceSettingUpdater();
  const { aiSetting: originalSetting } = useInstance();
  const [providers, setProviders] = useState<LocalAIProvider[]>(() => originalSetting.providers.map(toLocalProvider));
  const [transcription, setTranscription] = useState<LocalTranscription>(() => toLocalTranscription(originalSetting.transcription));
  const [chat, setChat] = useState<LocalChat>(() => toLocalChat(originalSetting.chat));
  const [editingProvider, setEditingProvider] = useState<LocalAIProvider | undefined>();
  const [deleteTarget, setDeleteTarget] = useState<LocalAIProvider | undefined>();

  useEffect(() => {
    setProviders(originalSetting.providers.map(toLocalProvider));
  }, [originalSetting.providers]);

  // Only re-sync the transcription draft when the server-side content actually
  // changes — not on every originalSetting identity change. This prevents
  // provider-side saves (which keep transcription unchanged on the server) from
  // wiping an in-progress transcription draft.
  const lastSyncedTranscription = useRef<LocalTranscription>(toLocalTranscription(originalSetting.transcription));
  useEffect(() => {
    const next = toLocalTranscription(originalSetting.transcription);
    if (!isEqual(lastSyncedTranscription.current, next)) {
      setTranscription(next);
      lastSyncedTranscription.current = next;
    }
  }, [originalSetting.transcription]);

  // The chat draft needs the same protection as the transcription draft.
  const lastSyncedChat = useRef<LocalChat>(toLocalChat(originalSetting.chat));
  useEffect(() => {
    const next = toLocalChat(originalSetting.chat);
    if (!isEqual(lastSyncedChat.current, next)) {
      setChat(next);
      lastSyncedChat.current = next;
    }
  }, [originalSetting.chat]);

  const originalTranscription = useMemo(() => toLocalTranscription(originalSetting.transcription), [originalSetting.transcription]);
  const transcriptionHasChanges = !isEqual(transcription, originalTranscription);

  const originalChat = useMemo(() => toLocalChat(originalSetting.chat), [originalSetting.chat]);
  const chatHasChanges = !isEqual(chat, originalChat);

  const transcriptionProviderRef = useMemo(
    () => providers.find((provider) => provider.id === transcription.providerId),
    [providers, transcription.providerId],
  );

  // Persists the AI setting using explicit provider/transcription/chat values.
  // Provider operations pass the persisted drafts so an in-progress draft is
  // never accidentally committed.
  const persistAISetting = async (
    nextProviders: LocalAIProvider[],
    nextTranscription: InstanceSetting_TranscriptionConfig | undefined,
    nextChat: InstanceSetting_ChatConfig | undefined,
    errorContext: string,
  ) => {
    return saveInstanceSetting({
      key: InstanceSetting_Key.AI,
      setting: create(InstanceSettingSchema, {
        name: buildInstanceSettingName(InstanceSetting_Key.AI),
        value: {
          case: "aiSetting",
          value: create(InstanceSetting_AISettingSchema, {
            providers: nextProviders.map(toProviderConfig),
            transcription: nextTranscription,
            chat: nextChat,
          }),
        },
      }),
      errorContext,
    });
  };

  const handleCreateProvider = () => {
    setEditingProvider(newProvider());
  };

  const handleEditProvider = (provider: LocalAIProvider) => {
    setEditingProvider({ ...provider, apiKey: "" });
  };

  const handleSaveProvider = async (provider: LocalAIProvider) => {
    const title = provider.title.trim();
    const endpoint = provider.endpoint.trim();

    if (!title) {
      toast.error(t("setting.ai.provider-title-required"));
      return;
    }
    if (!provider.apiKeySet && !provider.apiKey.trim()) {
      toast.error(t("setting.ai.api-key-required"));
      return;
    }

    const normalizedProvider = { ...provider, title, endpoint };
    const exists = providers.some((item) => item.id === normalizedProvider.id);
    const nextProviders = exists
      ? providers.map((item) => (item.id === normalizedProvider.id ? normalizedProvider : item))
      : [...providers, normalizedProvider];

    const ok = await persistAISetting(nextProviders, originalSetting.transcription, originalSetting.chat, "Update AI provider");
    if (!ok) return;
    setProviders(nextProviders);
    setEditingProvider(undefined);
  };

  const handleDeleteProvider = async () => {
    if (!deleteTarget) return;
    const target = deleteTarget;
    const nextProviders = providers.filter((provider) => provider.id !== target.id);

    // If a persisted config references the deleted provider, the server would
    // reject the save (provider_id must reference an existing provider). Send a
    // cleared config in that case.
    const persistedTranscription = originalSetting.transcription;
    const nextTranscription =
      persistedTranscription && persistedTranscription.providerId === target.id
        ? create(InstanceSetting_TranscriptionConfigSchema, {})
        : persistedTranscription;

    const persistedChat = originalSetting.chat;
    const nextChat = persistedChat && persistedChat.providerId === target.id ? create(InstanceSetting_ChatConfigSchema, {}) : persistedChat;

    const ok = await persistAISetting(nextProviders, nextTranscription, nextChat, "Delete AI provider");
    if (!ok) return;
    setProviders(nextProviders);
    if (transcription.providerId === target.id) {
      setTranscription((prev) => ({ ...prev, providerId: "" }));
    }
    if (chat.providerId === target.id) {
      setChat((prev) => ({ ...prev, providerId: "" }));
    }
    setDeleteTarget(undefined);
  };

  const handleSaveTranscription = async () => {
    if (transcription.providerId && !transcriptionProviderRef) {
      toast.error(t("setting.ai.transcription-empty-providers"));
      return;
    }
    await persistAISetting(providers, toTranscriptionConfig(transcription), originalSetting.chat, "Update transcription");
  };

  const handleSaveChat = async () => {
    if (chat.providerId && !providers.some((provider) => provider.id === chat.providerId)) {
      toast.error(t("setting.ai.transcription-empty-providers"));
      return;
    }
    await persistAISetting(providers, originalSetting.transcription, toChatConfig(chat), "Update chat");
  };

  return (
    <SettingSection
      title={t("setting.ai.label")}
      actions={
        <Button onClick={handleCreateProvider}>
          <PlusIcon className="w-4 h-4 mr-2" />
          {t("setting.ai.add-provider")}
        </Button>
      }
    >
      <SettingPanel className="bg-muted/30 px-4 py-3">
        <div className="flex max-w-3xl flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md border border-border bg-background px-2 py-0.5 text-xs font-medium text-foreground">
              {t("setting.ai.byok-label")}
            </span>
            <h4 className="text-sm font-semibold text-foreground">{t("setting.ai.byok-title")}</h4>
          </div>
          <p className="text-sm text-muted-foreground">{t("setting.ai.byok-description")}</p>
          <ul className="space-y-1 text-sm text-muted-foreground">
            {byokNotes.map((note) => (
              <li key={note} className="flex gap-2">
                <span className="mt-2 size-1 rounded-full bg-muted-foreground/60" aria-hidden />
                <span>{t(note)}</span>
              </li>
            ))}
          </ul>
        </div>
      </SettingPanel>

      <SettingGroup title={t("setting.ai.integrations-title")} description={t("setting.ai.integrations-description")}>
        <SettingTable
          columns={[
            {
              key: "title",
              header: t("common.name"),
              render: (_, provider: LocalAIProvider) => (
                <div className="flex flex-col gap-0.5">
                  <span className="text-foreground">{provider.title}</span>
                  <span className="font-mono text-xs text-muted-foreground">{provider.id}</span>
                </div>
              ),
            },
            {
              key: "type",
              header: t("setting.ai.provider-type"),
              render: (_, provider: LocalAIProvider) => <span>{getProviderTypeLabel(provider.type)}</span>,
            },
            {
              key: "endpoint",
              header: t("setting.ai.endpoint"),
              render: (_, provider: LocalAIProvider) => (
                <span className="font-mono text-xs">{provider.endpoint || t("setting.ai.default-endpoint")}</span>
              ),
            },
            {
              key: "apiKeySet",
              header: t("setting.ai.api-key"),
              render: (_, provider: LocalAIProvider) => (
                <span className="font-mono text-xs">{provider.apiKeySet ? provider.apiKeyHint || t("setting.ai.configured") : "-"}</span>
              ),
            },
            {
              key: "actions",
              header: "",
              className: "text-right",
              render: (_, provider: LocalAIProvider) => (
                <DropdownMenu>
                  <DropdownMenuTrigger render={<Button variant="outline" size="sm" />}>
                    <MoreVerticalIcon className="w-4 h-auto" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" sideOffset={2}>
                    <DropdownMenuItem onClick={() => handleEditProvider(provider)}>{t("common.edit")}</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setDeleteTarget(provider)} className="text-destructive focus:text-destructive">
                      {t("common.delete")}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ),
            },
          ]}
          data={providers}
          emptyMessage={t("setting.ai.no-providers")}
          getRowKey={(provider) => provider.id}
        />
      </SettingGroup>

      <SettingGroup
        title={t("setting.ai.transcription-title")}
        description={t("setting.ai.transcription-description")}
        showSeparator
        actions={
          <Button disabled={!transcriptionHasChanges} onClick={handleSaveTranscription}>
            {t("common.save")}
          </Button>
        }
      >
        <TranscriptionForm
          providers={providers}
          transcription={transcription}
          onChange={setTranscription}
          referencedProvider={transcriptionProviderRef}
        />
      </SettingGroup>

      <SettingGroup
        title={t("setting.ai.chat-title")}
        description={t("setting.ai.chat-description")}
        showSeparator
        actions={
          <Button disabled={!chatHasChanges} onClick={handleSaveChat}>
            {t("common.save")}
          </Button>
        }
      >
        <ChatForm providers={providers} chat={chat} onChange={setChat} />
      </SettingGroup>

      <AIProviderDialog
        provider={editingProvider}
        onOpenChange={(open) => !open && setEditingProvider(undefined)}
        onSave={handleSaveProvider}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(undefined)}
        title={deleteTarget ? t("setting.ai.delete-provider", { title: deleteTarget.title }) : ""}
        confirmLabel={t("common.delete")}
        cancelLabel={t("common.cancel")}
        onConfirm={handleDeleteProvider}
        confirmVariant="destructive"
      />
    </SettingSection>
  );
};

interface TranscriptionFormProps {
  providers: LocalAIProvider[];
  transcription: LocalTranscription;
  referencedProvider: LocalAIProvider | undefined;
  onChange: (next: LocalTranscription) => void;
}

const TranscriptionForm = ({ providers, transcription, referencedProvider, onChange }: TranscriptionFormProps) => {
  const t = useTranslate();
  const transcriptionProviders = useMemo(
    () => providers.filter((provider) => isTranscriptionCapableProviderType(provider.type)),
    [providers],
  );
  const noProviders = transcriptionProviders.length === 0;

  const providerOptions = useMemo(
    () => [
      { value: "__none__", label: t("setting.ai.transcription-no-provider") },
      ...transcriptionProviders.map((provider) => ({ value: provider.id, label: provider.title || provider.id })),
    ],
    [transcriptionProviders, t],
  );

  const update = (partial: Partial<LocalTranscription>) => {
    onChange({ ...transcription, ...partial });
  };

  const placeholderForProvider = (provider: LocalAIProvider | undefined) => {
    if (!provider) return "";
    return provider.type === InstanceSetting_AIProviderType.GEMINI
      ? t("setting.ai.transcription-model-placeholder-gemini")
      : t("setting.ai.transcription-model-placeholder-openai");
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-3xl">
      <div className="flex flex-col gap-1.5 sm:col-span-2">
        <Label>{t("setting.ai.transcription-provider")}</Label>
        <Select
          value={transcription.providerId || "__none__"}
          items={providerOptions}
          onValueChange={(value) => update({ providerId: value === "__none__" ? "" : value })}
          disabled={noProviders}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {providerOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {noProviders && <p className="text-xs text-muted-foreground">{t("setting.ai.transcription-empty-providers")}</p>}
        {referencedProvider && !referencedProvider.apiKeySet && (
          <p className="text-xs text-destructive">{t("setting.ai.transcription-warning-no-key")}</p>
        )}
      </div>

      <div className="flex flex-col gap-1.5 sm:col-span-2">
        <Label>{t("setting.ai.transcription-model")}</Label>
        <Input
          value={transcription.model}
          onChange={(e) => update({ model: e.target.value })}
          placeholder={placeholderForProvider(referencedProvider)}
          disabled={!transcription.providerId}
          maxLength={256}
        />
        <p className="text-xs text-muted-foreground">{t("setting.ai.transcription-model-help")}</p>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>{t("setting.ai.transcription-language")}</Label>
        <Input
          value={transcription.language}
          onChange={(e) => update({ language: e.target.value })}
          placeholder={t("setting.ai.transcription-language-placeholder")}
          disabled={!transcription.providerId}
          maxLength={32}
        />
        <p className="text-xs text-muted-foreground">{t("setting.ai.transcription-language-help")}</p>
      </div>

      <div className="flex flex-col gap-1.5 sm:col-span-2">
        <Label>{t("setting.ai.transcription-prompt")}</Label>
        <Textarea
          value={transcription.prompt}
          onChange={(e) => update({ prompt: e.target.value })}
          placeholder={t("setting.ai.transcription-prompt-placeholder")}
          rows={3}
          disabled={!transcription.providerId}
          maxLength={4096}
        />
        <p className="text-xs text-muted-foreground">{t("setting.ai.transcription-prompt-help")}</p>
      </div>
    </div>
  );
};

interface ChatFormProps {
  providers: LocalAIProvider[];
  chat: LocalChat;
  onChange: (next: LocalChat) => void;
}

const ChatForm = ({ providers, chat, onChange }: ChatFormProps) => {
  const t = useTranslate();
  // Only providers that speak the OpenAI wire protocol can run chat.
  const chatProviders = useMemo(() => providers.filter((provider) => isChatCapableProviderType(provider.type)), [providers]);
  const [models, setModels] = useState<string[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);

  const selectedProvider = useMemo(
    () => chatProviders.find((provider) => provider.id === chat.providerId),
    [chatProviders, chat.providerId],
  );

  const providerOptions = useMemo(
    () => [
      { value: "__none__", label: t("setting.ai.chat-no-provider") },
      ...chatProviders.map((provider) => ({ value: provider.id, label: provider.title || provider.id })),
    ],
    [chatProviders, t],
  );

  // Drop a fetched catalog when the provider changes, since slugs are not
  // portable between providers.
  useEffect(() => {
    setModels([]);
  }, [chat.providerId]);

  const update = (partial: Partial<LocalChat>) => {
    onChange({ ...chat, ...partial });
  };

  // Loads the provider's model catalog so the user picks a real slug instead of
  // typing one from memory.
  const handleLoadModels = async () => {
    if (!chat.providerId) return;
    setIsLoadingModels(true);
    try {
      const response = await aiServiceClient.listProviderModels({ providerId: chat.providerId });
      setModels(response.models.map((model) => model.id));
      if (response.models.length === 0) {
        toast.error(t("setting.ai.chat-no-models"));
      }
    } catch (error: unknown) {
      await handleError(error, toast.error, { context: "List provider models" });
    } finally {
      setIsLoadingModels(false);
    }
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-3xl">
      <div className="flex flex-col gap-1.5 sm:col-span-2">
        <Label>{t("setting.ai.chat-provider")}</Label>
        <Select
          value={chat.providerId || "__none__"}
          items={providerOptions}
          onValueChange={(value) => update({ providerId: value === "__none__" ? "" : value })}
          disabled={chatProviders.length === 0}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {providerOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {chatProviders.length === 0 && <p className="text-xs text-muted-foreground">{t("setting.ai.chat-empty-providers")}</p>}
      </div>

      <div className="flex flex-col gap-1.5 sm:col-span-2">
        <Label>{t("setting.ai.chat-model")}</Label>
        <div className="flex gap-2">
          <Input
            value={chat.model}
            onChange={(e) => update({ model: e.target.value })}
            placeholder={t("setting.ai.chat-model-placeholder")}
            disabled={!chat.providerId}
            maxLength={256}
            list="chat-model-options"
          />
          <datalist id="chat-model-options">
            {models.map((model) => (
              <option key={model} value={model} />
            ))}
          </datalist>
          <Button
            type="button"
            variant="outline"
            disabled={!chat.providerId || isLoadingModels}
            onClick={handleLoadModels}
            aria-label={t("setting.ai.chat-load-models")}
          >
            <RefreshCwIcon className={`w-4 h-4 ${isLoadingModels ? "animate-spin" : ""}`} />
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          {models.length > 0 ? t("setting.ai.chat-models-loaded", { count: models.length }) : t("setting.ai.chat-model-help")}
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>{t("setting.ai.chat-context-budget")}</Label>
        <Input
          type="number"
          min={0}
          value={chat.contextBudgetTokens}
          onChange={(e) => update({ contextBudgetTokens: e.target.value })}
          placeholder={String(DEFAULT_CHAT_CONTEXT_BUDGET_TOKENS)}
          disabled={!chat.providerId}
        />
        <p className="text-xs text-muted-foreground">{t("setting.ai.chat-context-budget-help")}</p>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>{t("setting.ai.chat-max-completion")}</Label>
        <Input
          type="number"
          min={0}
          value={chat.maxCompletionTokens}
          onChange={(e) => update({ maxCompletionTokens: e.target.value })}
          placeholder={t("setting.ai.chat-max-completion-placeholder")}
          disabled={!chat.providerId}
        />
        <p className="text-xs text-muted-foreground">{t("setting.ai.chat-max-completion-help")}</p>
      </div>

      {selectedProvider && !selectedProvider.apiKeySet && (
        <p className="text-xs text-destructive sm:col-span-2">{t("setting.ai.transcription-warning-no-key")}</p>
      )}
    </div>
  );
};

interface AIProviderDialogProps {
  provider?: LocalAIProvider;
  onOpenChange: (open: boolean) => void;
  onSave: (provider: LocalAIProvider) => void;
}

const AIProviderDialog = ({ provider, onOpenChange, onSave }: AIProviderDialogProps) => {
  const t = useTranslate();
  const [draft, setDraft] = useState<LocalAIProvider>(() => provider ?? newProvider());

  useEffect(() => {
    const next = provider ?? newProvider();
    setDraft(next);
  }, [provider]);

  const updateDraft = (partial: Partial<LocalAIProvider>) => {
    setDraft((prev) => ({ ...prev, ...partial }));
  };

  const handleSave = () => {
    onSave(draft);
  };

  return (
    <Dialog open={!!provider} onOpenChange={onOpenChange}>
      <DialogContent size="2xl">
        <DialogHeader>
          <DialogTitle>{provider?.apiKeySet ? t("setting.ai.edit-provider") : t("setting.ai.add-provider")}</DialogTitle>
          <DialogDescription>{t("setting.ai.dialog-description")}</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <Label>{t("setting.ai.provider-title")}</Label>
            <Input value={draft.title} onChange={(e) => updateDraft({ title: e.target.value })} placeholder="OpenAI" />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>{t("setting.ai.provider-type")}</Label>
            <Select
              value={String(draft.type)}
              items={providerTypeSelectOptions}
              onValueChange={(value) => updateDraft({ type: Number(value) as InstanceSetting_AIProviderType })}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {providerTypeSelectOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label>{t("setting.ai.endpoint")}</Label>
            <Input
              value={draft.endpoint}
              onChange={(e) => updateDraft({ endpoint: e.target.value })}
              placeholder={getDefaultEndpointPlaceholder(draft.type)}
            />
            <p className="text-xs text-muted-foreground">{t("setting.ai.endpoint-hint")}</p>
          </div>

          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label>{t("setting.ai.api-key")}</Label>
            <Input
              type="password"
              value={draft.apiKey}
              onChange={(e) => updateDraft({ apiKey: e.target.value })}
              placeholder={draft.apiKeySet ? t("setting.ai.keep-api-key") : ""}
            />
            {draft.apiKeySet && (
              <p className="text-xs text-muted-foreground">{t("setting.ai.current-key", { key: draft.apiKeyHint || "-" })}</p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          <Button onClick={handleSave}>{t("common.save")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AISection;
