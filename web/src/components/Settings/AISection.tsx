import { create } from "@bufbuild/protobuf";
import { Badge, Button, Dialog, Field, Input, Menu, Select, Textarea, Tooltip } from "@usememos/ui";
import { isEqual } from "lodash-es";
import { MoreVerticalIcon, PlusIcon } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import ConfirmDialog from "@/components/ConfirmDialog";
import { useInstance } from "@/contexts/InstanceContext";
import { isFieldManaged, useManagedResource } from "@/hooks/useConfigurationQueries";
import { useFieldErrors } from "@/hooks/useFieldErrors";
import { showErrorToast } from "@/lib/toast";
import {
  InstanceSetting_AIProviderConfig,
  InstanceSetting_AIProviderConfigSchema,
  InstanceSetting_AIProviderType,
  InstanceSetting_AISettingSchema,
  InstanceSetting_Key,
  InstanceSetting_TranscriptionConfig,
  InstanceSetting_TranscriptionConfigSchema,
  InstanceSettingSchema,
} from "@/types/proto/api/instance_service_pb";
import { useTranslate } from "@/utils/i18n";
import ManagedByConfigurationChip from "./ManagedByConfigurationChip";
import SettingGroup from "./SettingGroup";
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

const providerTypeOptions = [InstanceSetting_AIProviderType.OPENAI, InstanceSetting_AIProviderType.GEMINI];

const byokNotes = ["setting.ai.byok-key-note", "setting.ai.byok-storage-note", "setting.ai.byok-model-note"] as const;

const getProviderTypeLabel = (type: InstanceSetting_AIProviderType) => {
  return InstanceSetting_AIProviderType[type] ?? "UNKNOWN";
};

const providerTypeSelectOptions = providerTypeOptions.map((type) => ({ value: String(type), label: getProviderTypeLabel(type) }));

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

const AISection = () => {
  const t = useTranslate();
  const managed = useManagedResource(buildInstanceSettingName(InstanceSetting_Key.AI));
  const providersLocked = isFieldManaged(managed, "aiSetting.providers");
  const transcriptionLocked = isFieldManaged(managed, "aiSetting.transcription");
  const saveInstanceSetting = useInstanceSettingUpdater();
  const { aiSetting: originalSetting } = useInstance();
  const [providers, setProviders] = useState<LocalAIProvider[]>(() => originalSetting.providers.map(toLocalProvider));
  const [transcription, setTranscription] = useState<LocalTranscription>(() => toLocalTranscription(originalSetting.transcription));
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

  const originalTranscription = useMemo(() => toLocalTranscription(originalSetting.transcription), [originalSetting.transcription]);
  const transcriptionHasChanges = !isEqual(transcription, originalTranscription);

  const transcriptionProviderRef = useMemo(
    () => providers.find((provider) => provider.id === transcription.providerId),
    [providers, transcription.providerId],
  );

  // Persists the AI setting using a specific providers list and transcription
  // value. Provider operations pass originalSetting.transcription so an
  // in-progress transcription draft is never accidentally committed.
  const persistAISetting = async (
    nextProviders: LocalAIProvider[],
    nextTranscription: InstanceSetting_TranscriptionConfig | undefined,
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

    const normalizedProvider = { ...provider, title, endpoint };
    const exists = providers.some((item) => item.id === normalizedProvider.id);
    const nextProviders = exists
      ? providers.map((item) => (item.id === normalizedProvider.id ? normalizedProvider : item))
      : [...providers, normalizedProvider];

    const ok = await persistAISetting(nextProviders, originalSetting.transcription, "Update AI provider");
    if (!ok) return;
    setProviders(nextProviders);
    setEditingProvider(undefined);
  };

  const handleDeleteProvider = async () => {
    if (!deleteTarget) return;
    const target = deleteTarget;
    const nextProviders = providers.filter((provider) => provider.id !== target.id);

    // If the persisted transcription references the deleted provider, the
    // server would reject the save (provider_id must reference an existing
    // provider). Send a cleared transcription in that case.
    const persistedTranscription = originalSetting.transcription;
    const nextTranscription =
      persistedTranscription && persistedTranscription.providerId === target.id
        ? create(InstanceSetting_TranscriptionConfigSchema, {})
        : persistedTranscription;

    const ok = await persistAISetting(nextProviders, nextTranscription, "Delete AI provider");
    if (!ok) return;
    setProviders(nextProviders);
    if (transcription.providerId === target.id) {
      setTranscription((prev) => ({ ...prev, providerId: "" }));
    }
    setDeleteTarget(undefined);
  };

  const handleSaveTranscription = async () => {
    if (transcription.providerId && !transcriptionProviderRef) {
      showErrorToast(t("setting.ai.transcription-empty-providers"));
      return;
    }
    await persistAISetting(providers, toTranscriptionConfig(transcription), "Update transcription");
  };

  return (
    <SettingSection
      title={t("setting.ai.label")}
      actions={
        <Button variant="neutral" disabled={providersLocked} onClick={handleCreateProvider} icon={<PlusIcon />}>
          {t("setting.ai.add-provider")}
        </Button>
      }
    >
      <div>
        <div className="flex max-w-3xl flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="outline">{t("setting.ai.byok-label")}</Badge>
            <h4 className="mu-label text-mu-text">{t("setting.ai.byok-title")}</h4>
          </div>
          <p className="mu-body text-mu-text-secondary">{t("setting.ai.byok-description")}</p>
          <ul className="space-y-1 mu-body text-mu-text-secondary">
            {byokNotes.map((note) => (
              <li key={note} className="flex gap-2">
                <span className="mt-2 size-1 rounded-full bg-mu-text-secondary/60" aria-hidden />
                <span>{t(note)}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <SettingGroup
        title={t("setting.ai.integrations-title")}
        description={t("setting.ai.integrations-description")}
        actions={providersLocked ? <ManagedByConfigurationChip resource={managed} /> : undefined}
      >
        <SettingTable
          columns={[
            {
              key: "title",
              header: t("common.name"),
              render: (_, provider: LocalAIProvider) => (
                <div className="flex flex-col gap-0.5">
                  <span className="text-mu-text">{provider.title}</span>
                  <span className="font-mono mu-caption text-mu-text-secondary">{provider.id}</span>
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
                <span className="font-mono mu-caption">{provider.endpoint || t("setting.ai.default-endpoint")}</span>
              ),
            },
            {
              key: "apiKeySet",
              header: t("setting.ai.api-key"),
              render: (_, provider: LocalAIProvider) => (
                <span className="font-mono mu-caption">{provider.apiKeySet ? provider.apiKeyHint || t("setting.ai.configured") : "-"}</span>
              ),
            },
            {
              key: "actions",
              header: "",
              alignEnd: true,
              render: (_, provider: LocalAIProvider) => (
                <Menu.Root modal={false}>
                  <Tooltip.Root>
                    <Tooltip.Trigger
                      render={
                        <Menu.Trigger
                          render={
                            <Button variant="ghost" aria-label={`${t("common.more")}: ${provider.title}`} icon={<MoreVerticalIcon />} />
                          }
                        />
                      }
                    />
                    <Tooltip.Popup>{t("common.more")}</Tooltip.Popup>
                  </Tooltip.Root>
                  <Menu.Popup align="end">
                    <Menu.Item disabled={providersLocked} onClick={() => handleEditProvider(provider)}>
                      {t("common.edit")}
                    </Menu.Item>
                    {providersLocked ? null : (
                      <Menu.Item onClick={() => setDeleteTarget(provider)} danger>
                        {t("common.delete")}
                      </Menu.Item>
                    )}
                  </Menu.Popup>
                </Menu.Root>
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
          <>
            {transcriptionLocked ? <ManagedByConfigurationChip resource={managed} /> : null}
            <Button variant="primary" disabled={transcriptionLocked || !transcriptionHasChanges} onClick={handleSaveTranscription}>
              {t("common.save")}
            </Button>
          </>
        }
      >
        <TranscriptionForm
          locked={transcriptionLocked}
          providers={providers}
          transcription={transcription}
          onChange={setTranscription}
          referencedProvider={transcriptionProviderRef}
        />
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
        confirmVariant="danger"
      />
    </SettingSection>
  );
};

interface TranscriptionFormProps {
  locked: boolean;
  providers: LocalAIProvider[];
  transcription: LocalTranscription;
  referencedProvider: LocalAIProvider | undefined;
  onChange: (next: LocalTranscription) => void;
}

const TranscriptionForm = ({ locked, providers, transcription, referencedProvider, onChange }: TranscriptionFormProps) => {
  const t = useTranslate();
  const noProviders = providers.length === 0;
  const fieldsDisabled = locked || !transcription.providerId;

  const providerOptions = useMemo(
    () => [
      { value: "__none__", label: t("setting.ai.transcription-no-provider") },
      ...providers.map((provider) => ({ value: provider.id, label: provider.title || provider.id })),
    ],
    [providers, t],
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
      <Field.Root className="sm:col-span-2">
        <Field.Label>{t("setting.ai.transcription-provider")}</Field.Label>
        <Select.Root
          value={transcription.providerId || "__none__"}
          items={providerOptions}
          onValueChange={(value) => update({ providerId: !value || value === "__none__" ? "" : value })}
          disabled={locked || noProviders}
        >
          <Select.Trigger className="w-full">
            <Select.Value />
          </Select.Trigger>
          <Select.Popup>
            {providerOptions.map((option) => (
              <Select.Item key={option.value} value={option.value}>
                {option.label}
              </Select.Item>
            ))}
          </Select.Popup>
        </Select.Root>
        {noProviders && <Field.Description>{t("setting.ai.transcription-empty-providers")}</Field.Description>}
        {referencedProvider && !referencedProvider.apiKeySet && (
          <p className="mu-caption text-mu-danger">{t("setting.ai.transcription-warning-no-key")}</p>
        )}
      </Field.Root>

      <Field.Root className="sm:col-span-2">
        <Field.Label>{t("setting.ai.transcription-model")}</Field.Label>
        <Input
          value={transcription.model}
          onChange={(e) => update({ model: e.target.value })}
          placeholder={placeholderForProvider(referencedProvider)}
          disabled={fieldsDisabled}
          maxLength={256}
        />
        <Field.Description>{t("setting.ai.transcription-model-help")}</Field.Description>
      </Field.Root>

      <Field.Root>
        <Field.Label>{t("setting.ai.transcription-language")}</Field.Label>
        <Input
          value={transcription.language}
          onChange={(e) => update({ language: e.target.value })}
          placeholder={t("setting.ai.transcription-language-placeholder")}
          disabled={fieldsDisabled}
          maxLength={32}
        />
        <Field.Description>{t("setting.ai.transcription-language-help")}</Field.Description>
      </Field.Root>

      <Field.Root className="sm:col-span-2">
        <Field.Label>{t("setting.ai.transcription-prompt")}</Field.Label>
        <Textarea
          value={transcription.prompt}
          onChange={(e) => update({ prompt: e.target.value })}
          placeholder={t("setting.ai.transcription-prompt-placeholder")}
          rows={3}
          disabled={fieldsDisabled}
          maxLength={4096}
        />
        <Field.Description>{t("setting.ai.transcription-prompt-help")}</Field.Description>
      </Field.Root>
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
  const fieldErrors = useFieldErrors<"title" | "apiKey">();

  // A newly opened provider starts clean: its draft and no errors from the last one.
  useEffect(() => {
    const next = provider ?? newProvider();
    setDraft(next);
    fieldErrors.clear("title");
    fieldErrors.clear("apiKey");
  }, [provider]);

  const updateDraft = (partial: Partial<LocalAIProvider>) => {
    setDraft((prev) => ({ ...prev, ...partial }));
  };

  // Missing fields show under the field, as in the other settings dialogs.
  const handleSave = () => {
    if (!draft.title.trim()) {
      fieldErrors.set("title", t("setting.ai.provider-title-required"));
      return;
    }
    if (!draft.apiKeySet && !draft.apiKey.trim()) {
      fieldErrors.set("apiKey", t("setting.ai.api-key-required"));
      return;
    }
    onSave(draft);
  };

  return (
    <Dialog.Root open={!!provider} onOpenChange={onOpenChange}>
      <Dialog.Popup closeLabel={t("common.close")} style={{ "--mu-dialog-width": "42rem" } as React.CSSProperties}>
        <Dialog.Title>{provider?.apiKeySet ? t("setting.ai.edit-provider") : t("setting.ai.add-provider")}</Dialog.Title>
        <Dialog.Description>{t("setting.ai.dialog-description")}</Dialog.Description>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field.Root invalid={!!fieldErrors.errors.title}>
            <Field.Label>{t("setting.ai.provider-title")}</Field.Label>
            <Input
              value={draft.title}
              onChange={(e) => {
                updateDraft({ title: e.target.value });
                fieldErrors.clear("title");
              }}
              placeholder="OpenAI"
            />
            {fieldErrors.errors.title && <Field.Error match>{fieldErrors.errors.title}</Field.Error>}
          </Field.Root>

          <Field.Root>
            <Field.Label>{t("setting.ai.provider-type")}</Field.Label>
            <Select.Root
              value={String(draft.type)}
              items={providerTypeSelectOptions}
              onValueChange={(value) => updateDraft({ type: Number(value) as InstanceSetting_AIProviderType })}
            >
              <Select.Trigger className="w-full">
                <Select.Value />
              </Select.Trigger>
              <Select.Popup>
                {providerTypeSelectOptions.map((option) => (
                  <Select.Item key={option.value} value={option.value}>
                    {option.label}
                  </Select.Item>
                ))}
              </Select.Popup>
            </Select.Root>
          </Field.Root>

          <Field.Root className="sm:col-span-2">
            <Field.Label>{t("setting.ai.endpoint")}</Field.Label>
            <Input
              value={draft.endpoint}
              onChange={(e) => updateDraft({ endpoint: e.target.value })}
              placeholder={getDefaultEndpointPlaceholder(draft.type)}
            />
            <Field.Description>{t("setting.ai.endpoint-hint")}</Field.Description>
          </Field.Root>

          <Field.Root className="sm:col-span-2" invalid={!!fieldErrors.errors.apiKey}>
            <Field.Label>{t("setting.ai.api-key")}</Field.Label>
            <Input
              type="password"
              value={draft.apiKey}
              onChange={(e) => {
                updateDraft({ apiKey: e.target.value });
                fieldErrors.clear("apiKey");
              }}
              placeholder={draft.apiKeySet ? t("setting.ai.keep-api-key") : ""}
            />
            {draft.apiKeySet && (
              <p className="mu-caption text-mu-text-secondary">{t("setting.ai.current-key", { key: draft.apiKeyHint || "-" })}</p>
            )}
            {fieldErrors.errors.apiKey && <Field.Error match>{fieldErrors.errors.apiKey}</Field.Error>}
          </Field.Root>
        </div>

        <Dialog.Footer>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          <Button variant="primary" onClick={handleSave}>
            {t("common.save")}
          </Button>
        </Dialog.Footer>
      </Dialog.Popup>
    </Dialog.Root>
  );
};

const getDefaultEndpointPlaceholder = (type: InstanceSetting_AIProviderType) => {
  switch (type) {
    case InstanceSetting_AIProviderType.OPENAI:
      return "https://api.openai.com/v1";
    case InstanceSetting_AIProviderType.GEMINI:
      return "https://generativelanguage.googleapis.com/v1beta";
    default:
      return "";
  }
};

export default AISection;
