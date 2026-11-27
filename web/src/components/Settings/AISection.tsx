import { create } from "@bufbuild/protobuf";
import { Badge, Button, Combobox, Dialog, Field, Input, Link, Menu, Select, Spinner, Textarea, Tooltip } from "@usememos/ui";
import { isEqual } from "lodash-es";
import { CircleAlertIcon, EllipsisIcon, EyeIcon, EyeOffIcon, PlayIcon, PlusIcon } from "lucide-react";
import { Fragment, type ReactNode, useEffect, useId, useMemo, useRef, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import ConfirmDialog from "@/components/ConfirmDialog";
import { useInstance } from "@/contexts/InstanceContext";
import { useAIProviderModels, useAIProviderTypes } from "@/hooks/useAIQueries";
import { isFieldManaged, useManagedResource } from "@/hooks/useConfigurationQueries";
import { useFieldErrors } from "@/hooks/useFieldErrors";
import { useOverflowTitle } from "@/hooks/useOverflowTitle";
import i18n from "@/i18n";
import { type AIFailureReason, getErrorInfo, getErrorMessage } from "@/lib/error";
import { AICapabilityKind, type AIProviderTypeInfo } from "@/types/proto/api/ai_service_pb";
import {
  InstanceSetting_AIProviderConfig,
  InstanceSetting_AIProviderConfigSchema,
  InstanceSetting_AIProviderType,
  InstanceSetting_AISettingSchema,
  InstanceSetting_Key,
  type InstanceSetting_TextGenerationConfig,
  InstanceSetting_TextGenerationConfigSchema,
  InstanceSetting_TranscriptionConfig,
  InstanceSetting_TranscriptionConfigSchema,
  InstanceSettingSchema,
} from "@/types/proto/api/instance_service_pb";
import { useTranslate } from "@/utils/i18n";
import ManagedByConfigurationChip from "./ManagedByConfigurationChip";
import SettingGroup from "./SettingGroup";
import SettingSection from "./SettingSection";
import SettingTable from "./SettingTable";
import TagSuggestionsPlayground from "./TagSuggestionsPlayground";
import TranscriptionPlayground from "./TranscriptionPlayground";
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

/** Services keep their own names; the two compatible types describe what they accept. */
const useProviderTypeLabel = () => {
  const t = useTranslate();
  return (type: InstanceSetting_AIProviderType) => {
    switch (type) {
      case InstanceSetting_AIProviderType.OPENAI:
        return "OpenAI";
      case InstanceSetting_AIProviderType.GEMINI:
        return "Google Gemini";
      case InstanceSetting_AIProviderType.ANTHROPIC:
        return "Anthropic";
      case InstanceSetting_AIProviderType.DEEPSEEK:
        return "DeepSeek";
      case InstanceSetting_AIProviderType.OPENROUTER:
        return "OpenRouter";
      case InstanceSetting_AIProviderType.OLLAMA:
        return "Ollama";
      case InstanceSetting_AIProviderType.OPENAI_COMPATIBLE:
        return t("setting.ai.provider-type-openai");
      case InstanceSetting_AIProviderType.ANTHROPIC_COMPATIBLE:
        return t("setting.ai.provider-type-anthropic-compatible");
      default:
        return "-";
    }
  };
};

const findSpec = (types: AIProviderTypeInfo[], type?: InstanceSetting_AIProviderType) => types.find((info) => info.type === type);

const suggestedModel = (spec: AIProviderTypeInfo | undefined, kind: AICapabilityKind) =>
  spec?.capabilities.find((capability) => capability.kind === kind)?.suggestedModel ?? "";

/** Until the catalog loads, every provider is offered, so a slot never flickers to empty. */
const canServe = (types: AIProviderTypeInfo[], provider: LocalAIProvider, kind: AICapabilityKind) => {
  if (types.length === 0) return true;
  return !!findSpec(types, provider.type)?.capabilities.some((capability) => capability.kind === kind);
};

/** The endpoint requests go to: the provider's own, or its type's default. */
const resolvedEndpoint = (types: AIProviderTypeInfo[], provider: Pick<LocalAIProvider, "type" | "endpoint">) =>
  (provider.endpoint.trim() || findSpec(types, provider.type)?.defaultEndpoint || "").replace(/\/+$/, "");

/** A masked key such as "sk-a…wxyz" identifies the key. A short key masks to dots only, which says nothing. */
const hasKeyHint = (provider: LocalAIProvider) => /[\p{L}\p{N}]/u.test(provider.apiKeyHint);

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
  title: "OpenAI",
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
  const providerTypeLabel = useProviderTypeLabel();
  const managed = useManagedResource(buildInstanceSettingName(InstanceSetting_Key.AI));
  const providersLocked = isFieldManaged(managed, "aiSetting.providers");
  const transcriptionLocked = isFieldManaged(managed, "aiSetting.transcription");
  const textGenerationLocked = isFieldManaged(managed, "aiSetting.textGeneration");
  const [savingSection, setSavingSection] = useState<"providers" | "transcription" | "textGeneration">();
  const saving = savingSection !== undefined;
  const saveInstanceSetting = useInstanceSettingUpdater();
  const { aiSetting: originalSetting } = useInstance();
  const providers = useMemo(() => originalSetting.providers.map(toLocalProvider), [originalSetting.providers]);
  const [transcription, setTranscription] = useState<LocalTranscription>(() => toLocalTranscription(originalSetting.transcription));
  const [editingProvider, setEditingProvider] = useState<LocalAIProvider | undefined>();
  const [deleteTarget, setDeleteTarget] = useState<LocalAIProvider | undefined>();
  const [providerError, setProviderError] = useState<string>();
  const [tryingTranscription, setTryingTranscription] = useState(false);
  const transcriptionErrors = useFieldErrors<"model">();
  const transcriptionModelRef = useRef<HTMLInputElement>(null);

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

  const savedTranscriptionProvider = providers.find((provider) => provider.id === originalSetting.transcription?.providerId);

  // The AI setting is replaced whole. Each section saves its own change on top of what is stored for
  // the other two, so an unsaved draft elsewhere on the page is never committed along with it.
  // `null` turns a capability off.
  const persistAISetting = async (
    errorContext: string,
    section: NonNullable<typeof savingSection>,
    changes: {
      providers?: LocalAIProvider[];
      transcription?: InstanceSetting_TranscriptionConfig | null;
      textGeneration?: InstanceSetting_TextGenerationConfig | null;
    },
    onError?: (error: unknown) => void,
  ) => {
    if (saving) return false;
    setSavingSection(section);
    try {
      return await saveInstanceSetting({
        key: InstanceSetting_Key.AI,
        setting: create(InstanceSettingSchema, {
          name: buildInstanceSettingName(InstanceSetting_Key.AI),
          value: {
            case: "aiSetting",
            value: create(InstanceSetting_AISettingSchema, {
              providers: (changes.providers ?? providers).map(toProviderConfig),
              transcription: changes.transcription === undefined ? originalSetting.transcription : (changes.transcription ?? undefined),
              textGeneration: changes.textGeneration === undefined ? originalSetting.textGeneration : (changes.textGeneration ?? undefined),
            }),
          },
        }),
        errorContext,
        onError,
      });
    } finally {
      setSavingSection(undefined);
    }
  };

  const handleSaveProvider = async (provider: LocalAIProvider) => {
    const normalizedProvider = { ...provider, title: provider.title.trim(), endpoint: provider.endpoint.trim() };
    const exists = providers.some((item) => item.id === normalizedProvider.id);
    const nextProviders = exists
      ? providers.map((item) => (item.id === normalizedProvider.id ? normalizedProvider : item))
      : [...providers, normalizedProvider];

    // The server checks a new or changed connection before saving; its answer belongs next to the fields that caused it.
    setProviderError(undefined);
    const ok = await persistAISetting("Update AI provider", "providers", { providers: nextProviders }, (error) =>
      setProviderError(getErrorMessage(error)),
    );
    if (!ok) return;
    setEditingProvider(undefined);
  };

  const handleDeleteProvider = async () => {
    if (!deleteTarget) return;
    const target = deleteTarget;
    const nextProviders = providers.filter((provider) => provider.id !== target.id);

    // A capability served by the deleted provider is turned off in the same update.
    const ok = await persistAISetting("Delete AI provider", "providers", {
      providers: nextProviders,
      transcription: originalSetting.transcription?.providerId === target.id ? null : undefined,
      textGeneration: originalSetting.textGeneration?.providerId === target.id ? null : undefined,
    });
    if (!ok) return;
    if (transcription.providerId === target.id) {
      setTranscription((prev) => ({ ...prev, providerId: "" }));
    }
    setDeleteTarget(undefined);
  };

  // The features a provider serves, as saved: what deleting it would turn off.
  const usedBy = (providerId: string) => {
    const features: string[] = [];
    if (originalSetting.transcription?.providerId === providerId) features.push(t("setting.ai.transcription-title"));
    if (originalSetting.textGeneration?.providerId === providerId) features.push(t("setting.ai.text-generation-title"));
    return features;
  };
  const affectedFeatures = deleteTarget ? usedBy(deleteTarget.id) : [];

  // Saving transcription needs a model; the field says so.
  const hasTranscriptionModel = () => {
    if (!transcription.providerId || transcription.model.trim()) return true;
    transcriptionErrors.set("model", t("setting.ai.model-required"));
    transcriptionModelRef.current?.focus();
    return false;
  };

  const handleSaveTranscription = async () => {
    if (!hasTranscriptionModel()) return;
    await persistAISetting("Update transcription", "transcription", {
      transcription: transcription.providerId ? toTranscriptionConfig(transcription) : null,
    });
  };

  return (
    <SettingSection title={t("setting.ai.label")} description={t("setting.ai.byok-description")}>
      <SettingGroup
        title={t("setting.ai.integrations-title")}
        actions={
          <>
            {providersLocked ? <ManagedByConfigurationChip resource={managed} /> : null}
            <Button variant="neutral" disabled={providersLocked} onClick={() => setEditingProvider(newProvider())} icon={<PlusIcon />}>
              {t("setting.ai.add-provider")}
            </Button>
          </>
        }
      >
        <SettingTable
          columns={[
            {
              key: "title",
              header: t("common.name"),
              render: (_, provider: LocalAIProvider) => (
                <span className="flex min-w-0 flex-col">
                  <span className="text-mu-text">{provider.title}</span>
                  {/* Only an endpoint the administrator chose is worth a line: the default is implied by the type. */}
                  {provider.endpoint && <EndpointCell text={provider.endpoint} />}
                </span>
              ),
            },
            {
              key: "type",
              header: t("setting.ai.provider-type"),
              render: (_, provider: LocalAIProvider) => <span>{providerTypeLabel(provider.type)}</span>,
            },
            {
              key: "status",
              header: t("setting.ai.status"),
              render: (_, provider: LocalAIProvider) => <ProviderStatus provider={provider} />,
            },
            {
              key: "usedBy",
              header: t("setting.ai.used-by"),
              render: (_, provider: LocalAIProvider) => {
                const features = usedBy(provider.id);
                return features.length ? (
                  <span>{new Intl.ListFormat(i18n.language).format(features)}</span>
                ) : (
                  <span className="text-mu-text-secondary">{t("setting.ai.not-used")}</span>
                );
              },
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
                          render={<Button variant="ghost" aria-label={`${t("common.more")}: ${provider.title}`} icon={<EllipsisIcon />} />}
                        />
                      }
                    />
                    <Tooltip.Popup>{t("common.more")}</Tooltip.Popup>
                  </Tooltip.Root>
                  <Menu.Popup align="end">
                    <Menu.Item disabled={providersLocked} onClick={() => setEditingProvider({ ...provider, apiKey: "" })}>
                      {t("common.edit")}
                    </Menu.Item>
                    {providersLocked ? null : (
                      <Menu.Item
                        disabled={
                          saving ||
                          (transcriptionLocked && originalSetting.transcription?.providerId === provider.id) ||
                          (textGenerationLocked && originalSetting.textGeneration?.providerId === provider.id)
                        }
                        onClick={() => setDeleteTarget(provider)}
                        danger
                      >
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

      <form
        aria-label={t("setting.ai.transcription-title")}
        className="flex flex-col gap-5"
        onSubmit={(event) => {
          event.preventDefault();
          if (!transcriptionLocked && transcriptionHasChanges) void handleSaveTranscription();
        }}
      >
        <SettingGroup
          title={t("setting.ai.transcription-title")}
          description={t("setting.ai.transcription-description")}
          showSeparator
          actions={transcriptionLocked ? <ManagedByConfigurationChip resource={managed} /> : undefined}
        >
          <TranscriptionForm
            locked={transcriptionLocked}
            saving={savingSection === "transcription"}
            providers={providers}
            transcription={transcription}
            referencedProvider={transcriptionProviderRef}
            modelRef={transcriptionModelRef}
            modelError={transcriptionErrors.errors.model}
            onChange={(next) => {
              setTranscription(next);
              transcriptionErrors.clear("model");
            }}
          />
          <FormActions canTry={!!savedTranscriptionProvider} onTry={() => setTryingTranscription(true)}>
            <Button
              variant="primary"
              type="submit"
              loading={savingSection === "transcription"}
              disabled={saving || transcriptionLocked || !transcriptionHasChanges}
            >
              {t("common.save")}
            </Button>
          </FormActions>
        </SettingGroup>
      </form>
      <TextGenerationSettings
        config={originalSetting.textGeneration}
        providers={providers}
        locked={textGenerationLocked}
        managed={managed}
        saving={savingSection === "textGeneration"}
        busy={saving}
        onSave={(config) => persistAISetting("Update text generation", "textGeneration", { textGeneration: config })}
      />

      <TranscriptionPlayground
        open={tryingTranscription}
        onOpenChange={setTryingTranscription}
        source={`${savedTranscriptionProvider?.title ?? ""} · ${originalSetting.transcription?.model ?? ""}`}
        unsaved={transcriptionHasChanges}
      />

      <AIProviderDialog
        provider={editingProvider}
        saving={savingSection === "providers"}
        error={providerError}
        onOpenChange={(open) => {
          if (open) return;
          setEditingProvider(undefined);
          setProviderError(undefined);
        }}
        onChange={() => setProviderError(undefined)}
        onSave={handleSaveProvider}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(undefined)}
        title={deleteTarget ? t("setting.ai.delete-provider", { title: deleteTarget.title }) : ""}
        description={
          affectedFeatures.length
            ? t("setting.ai.delete-provider-impact", { features: new Intl.ListFormat(i18n.language).format(affectedFeatures) })
            : t("setting.ai.delete-provider-description")
        }
        confirmLabel={t("common.delete")}
        cancelLabel={t("common.cancel")}
        onConfirm={handleDeleteProvider}
        confirmVariant="danger"
      />
    </SettingSection>
  );
};

/** One line of the endpoint: a long URL is cut with its full text in the title, so the row's actions stay in view. */
function EndpointCell({ text }: { text: string }) {
  const { ref, title } = useOverflowTitle<HTMLSpanElement>(text);
  return (
    <span ref={ref} title={title} className="block max-w-56 truncate font-mono mu-caption">
      {text}
    </span>
  );
}

/**
 * Whether the saved provider answers, from the model listing the slots use anyway. A refusal names
 * what to fix: the key, or the address. Its full message is the title.
 */
function ProviderStatus({ provider }: { provider: LocalAIProvider }) {
  const t = useTranslate();
  const { isPending, error } = useAIProviderModels(provider);
  if (isPending) return <Spinner label={t("setting.ai.checking-connection")} />;
  if (!error) return <Badge tone="success">{t("setting.ai.status-connected")}</Badge>;
  const reason = getErrorInfo(error)?.reason as AIFailureReason | undefined;
  // An account out of credit has a working key and endpoint: a warning to top up, not a broken setting.
  if (reason === "AI_PROVIDER_QUOTA_EXHAUSTED") {
    return (
      <Badge tone="warning" title={getErrorMessage(error)}>
        {t("setting.ai.status-out-of-credit")}
      </Badge>
    );
  }
  const label =
    reason === "AI_PROVIDER_AUTH_FAILED"
      ? t("setting.ai.status-invalid-key")
      : reason === "AI_PROVIDER_UNREACHABLE" || reason === "AI_PROVIDER_TIMEOUT" || reason === "AI_PROVIDER_REDIRECTED"
        ? t("setting.ai.status-unreachable")
        : t("setting.ai.status-error");
  return (
    <Badge tone="danger" title={getErrorMessage(error)}>
      {label}
    </Badge>
  );
}

/** The closing row of a feature form: Try it on the left, and the form's own action (Save) at the end, where the other settings pages keep it. */
function FormActions({ canTry, onTry, children }: { canTry: boolean; onTry: () => void; children: ReactNode }) {
  const t = useTranslate();
  return (
    <div className="flex max-w-3xl flex-wrap items-center gap-3">
      {/* A playground runs on the saved setting, so it is offered once there is one. */}
      {canTry && (
        <Button type="button" variant="neutral" icon={<PlayIcon />} onClick={onTry}>
          {t("setting.ai.try-it")}
        </Button>
      )}
      <div className="ms-auto flex shrink-0 items-center gap-2">{children}</div>
    </div>
  );
}

function ProviderField({
  providers,
  providerId,
  kind,
  locked,
  noneLabel,
  onChange,
}: {
  providers: LocalAIProvider[];
  providerId: string;
  kind: AICapabilityKind;
  locked: boolean;
  noneLabel: string;
  onChange: (id: string) => void;
}) {
  const t = useTranslate();
  const providerTypes = useAIProviderTypes();
  const noProviders = providers.length === 0;
  const capable = providers.filter((provider) => canServe(providerTypes, provider, kind));
  const incapable = providers.filter((provider) => !canServe(providerTypes, provider, kind));
  const providerOptions = useMemo(
    () => [
      { value: "__none__", label: noneLabel },
      ...providers.map((provider) => ({ value: provider.id, label: provider.title || provider.id })),
    ],
    [providers, noneLabel],
  );

  return (
    <Field.Root className="sm:col-span-2">
      <Field.Label>{t("setting.ai.transcription-provider")}</Field.Label>
      <Select.Root
        value={providerId || "__none__"}
        items={providerOptions}
        onValueChange={(value) => onChange(!value || value === "__none__" ? "" : value)}
        disabled={locked || noProviders}
      >
        <Select.Trigger className="w-full">
          <Select.Value />
        </Select.Trigger>
        <Select.Popup>
          <Select.Item value="__none__">{noneLabel}</Select.Item>
          {capable.map((provider) => (
            <Select.Item key={provider.id} value={provider.id}>
              {provider.title || provider.id}
            </Select.Item>
          ))}
          {/* Shown, not hidden, so a provider that cannot do this job does not seem to be missing. */}
          {incapable.length > 0 && (
            <>
              <Select.Separator />
              <Select.Group>
                <Select.GroupLabel>{t("setting.ai.cannot-transcribe")}</Select.GroupLabel>
                {incapable.map((provider) => (
                  <Select.Item key={provider.id} value={provider.id} disabled>
                    {provider.title || provider.id}
                  </Select.Item>
                ))}
              </Select.Group>
            </>
          )}
        </Select.Popup>
      </Select.Root>
      {noProviders && <Field.Description>{t("setting.ai.no-providers")}</Field.Description>}
    </Field.Root>
  );
}

/**
 * A model ID, typed or picked from what the saved provider lists. The type's suggested model comes
 * first. Any ID can be typed: some services do not list their models, and some list hundreds.
 */
function ModelField({
  provider,
  kind,
  value,
  inputRef,
  error,
  disabled,
  readOnly,
  onChange,
}: {
  provider: LocalAIProvider | undefined;
  kind: AICapabilityKind;
  value: string;
  inputRef?: React.Ref<HTMLInputElement>;
  error?: string;
  disabled: boolean;
  readOnly: boolean;
  onChange: (model: string) => void;
}) {
  const t = useTranslate();
  const providerTypes = useAIProviderTypes();
  const { data: models } = useAIProviderModels(provider);
  const suggested = suggestedModel(findSpec(providerTypes, provider?.type), kind);
  const items = useMemo(() => [...new Set([suggested, ...(models ?? [])].filter(Boolean))], [suggested, models]);
  // The suggested model, when there is one, is always first.
  const example = items[0] ?? "";

  return (
    <Field.Root className="sm:col-span-2" invalid={!!error}>
      <Field.Label>{t("setting.ai.transcription-model")}</Field.Label>
      <Combobox.Root
        items={items}
        inputValue={value}
        // The text is the value. A combobox resets its text to the picked item when it closes;
        // here nothing is picked by design, so only typing, picking and clearing change it.
        onInputValueChange={(next, details) => {
          if (details.reason === "input-change" || details.reason === "item-press" || details.reason === "input-clear") onChange(next);
        }}
        disabled={disabled}
        readOnly={readOnly}
      >
        <Combobox.Input
          ref={inputRef}
          icon={null}
          placeholder={example}
          aria-required
          maxLength={256}
          spellCheck={false}
          autoCapitalize="off"
          autoComplete="off"
        />
        <Combobox.Popup>
          <Combobox.Empty>{t("setting.ai.no-models-listed")}</Combobox.Empty>
          <Combobox.List>
            {(model: string) => (
              <Combobox.Item key={model} value={model}>
                {model}
              </Combobox.Item>
            )}
          </Combobox.List>
        </Combobox.Popup>
      </Combobox.Root>
      {example && <Field.Description>{t("setting.ai.model-help", { example })}</Field.Description>}
      {error && <Field.Error match>{error}</Field.Error>}
    </Field.Root>
  );
}

function TextGenerationSettings({
  config,
  providers,
  locked,
  managed,
  saving,
  busy,
  onSave,
}: {
  config?: InstanceSetting_TextGenerationConfig;
  providers: LocalAIProvider[];
  locked: boolean;
  managed: ReturnType<typeof useManagedResource>;
  saving: boolean;
  busy: boolean;
  /** `null` turns text generation off. */
  onSave: (config: InstanceSetting_TextGenerationConfig | null) => Promise<boolean>;
}) {
  const t = useTranslate();
  const fieldErrors = useFieldErrors<"model">();
  const modelRef = useRef<HTMLInputElement>(null);
  const [selectedId, setSelectedId] = useState(config?.providerId ?? "");
  const [model, setModel] = useState(config?.model ?? "");
  // Follow the saved config when it changes, during render rather than by remounting: a remount
  // would drop keyboard focus from the field or button that just saved.
  const saved = JSON.stringify([config?.providerId ?? "", config?.model ?? ""]);
  const [shown, setShown] = useState(saved);
  if (shown !== saved) {
    setShown(saved);
    setSelectedId(config?.providerId ?? "");
    setModel(config?.model ?? "");
  }
  const [trying, setTrying] = useState(false);
  const provider = providers.find((item) => item.id === selectedId);
  const providerId = provider?.id ?? "";
  const modelId = providerId ? model.trim() : "";
  const savedProvider = providers.find((item) => item.id === config?.providerId);
  const changed = providerId !== (config?.providerId ?? "") || modelId !== (config?.model ?? "");
  const canSave = !locked && !busy && changed;

  // Saving needs a model; the field says so instead of a disabled button staying silent.
  const hasModel = () => {
    if (!providerId || modelId) return true;
    fieldErrors.set("model", t("setting.ai.model-required"));
    modelRef.current?.focus();
    return false;
  };

  return (
    <>
      <form
        aria-label={t("setting.ai.text-generation-title")}
        className="flex flex-col gap-5"
        onSubmit={(event) => {
          event.preventDefault();
          if (!canSave || !hasModel()) return;
          void onSave(providerId ? create(InstanceSetting_TextGenerationConfigSchema, { providerId, model: modelId }) : null);
        }}
      >
        <SettingGroup
          title={t("setting.ai.text-generation-title")}
          description={t("setting.ai.text-generation-description")}
          showSeparator
          actions={locked ? <ManagedByConfigurationChip resource={managed} /> : undefined}
        >
          <div className="grid max-w-3xl grid-cols-1 gap-3 sm:grid-cols-2">
            <ProviderField
              providers={providers}
              providerId={providerId}
              locked={locked || saving}
              kind={AICapabilityKind.TEXT_GENERATION}
              noneLabel={t("setting.ai.text-generation-disabled")}
              onChange={(id) => {
                // The typed model stays: it is the writer's input, and clearing it would be a silent loss.
                setSelectedId(id);
                fieldErrors.clear("model");
              }}
            />
            {providerId && (
              <ModelField
                provider={provider}
                kind={AICapabilityKind.TEXT_GENERATION}
                value={model}
                inputRef={modelRef}
                error={fieldErrors.errors.model}
                disabled={locked}
                readOnly={saving}
                onChange={(next) => {
                  setModel(next);
                  fieldErrors.clear("model");
                }}
              />
            )}
          </div>
          <FormActions canTry={!!savedProvider} onTry={() => setTrying(true)}>
            <Button type="submit" variant="primary" loading={saving} disabled={!canSave}>
              {t("common.save")}
            </Button>
          </FormActions>
        </SettingGroup>
      </form>
      {/* Outside the form: React events bubble through the dialog's portal, so a nested submit would save this form. */}
      <TagSuggestionsPlayground
        open={trying}
        onOpenChange={setTrying}
        source={`${savedProvider?.title ?? ""} · ${config?.model ?? ""}`}
        unsaved={changed}
      />
    </>
  );
}

interface TranscriptionFormProps {
  locked: boolean;
  /** Read-only rather than disabled while saving: disabling the focused field would drop keyboard focus. */
  saving: boolean;
  providers: LocalAIProvider[];
  transcription: LocalTranscription;
  referencedProvider: LocalAIProvider | undefined;
  modelRef: React.Ref<HTMLInputElement>;
  modelError: string | undefined;
  onChange: (next: LocalTranscription) => void;
}

const TranscriptionForm = ({
  locked,
  saving,
  providers,
  transcription,
  referencedProvider,
  modelRef,
  modelError,
  onChange,
}: TranscriptionFormProps) => {
  const t = useTranslate();

  const update = (partial: Partial<LocalTranscription>) => {
    onChange({ ...transcription, ...partial });
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-3xl">
      <ProviderField
        providers={providers}
        providerId={transcription.providerId}
        locked={locked || saving}
        kind={AICapabilityKind.TRANSCRIPTION}
        noneLabel={t("setting.ai.transcription-no-provider")}
        onChange={(providerId) => update({ providerId })}
      />

      {/* The options belong to a provider, so they appear with one instead of sitting disabled. */}
      {transcription.providerId && (
        <>
          <ModelField
            provider={referencedProvider}
            kind={AICapabilityKind.TRANSCRIPTION}
            value={transcription.model}
            inputRef={modelRef}
            error={modelError}
            disabled={locked}
            readOnly={saving}
            onChange={(model) => update({ model })}
          />

          <Field.Root>
            <Field.Label>{t("setting.ai.transcription-language")}</Field.Label>
            <Input
              value={transcription.language}
              onChange={(e) => update({ language: e.target.value })}
              placeholder={t("setting.ai.transcription-language-placeholder")}
              disabled={locked}
              readOnly={saving}
              maxLength={32}
              spellCheck={false}
              autoCapitalize="off"
              autoComplete="off"
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
              disabled={locked}
              readOnly={saving}
              maxLength={4096}
            />
            <Field.Description>{t("setting.ai.transcription-prompt-help")}</Field.Description>
          </Field.Root>
        </>
      )}
    </div>
  );
};

interface AIProviderDialogProps {
  provider?: LocalAIProvider;
  saving: boolean;
  /** Why the last save was refused, such as a rejected key. */
  error?: string;
  onOpenChange: (open: boolean) => void;
  /** The draft changed, so the last refusal no longer describes it. */
  onChange: () => void;
  onSave: (provider: LocalAIProvider) => void;
}

const AIProviderDialog = ({ provider, saving, error, onOpenChange, onChange, onSave }: AIProviderDialogProps) => {
  const t = useTranslate();
  const providerTypeLabel = useProviderTypeLabel();
  const providerTypes = useAIProviderTypes();
  const formId = useId();
  const titleRef = useRef<HTMLInputElement>(null);
  const keyRef = useRef<HTMLInputElement>(null);
  const endpointRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState<LocalAIProvider>(() => provider ?? newProvider());
  const [keyVisible, setKeyVisible] = useState(false);
  const fieldErrors = useFieldErrors<"title" | "apiKey" | "endpoint">();
  const typeOptions = providerTypes.map((info) => ({ value: String(info.type), label: providerTypeLabel(info.type) }));
  const spec = findSpec(providerTypes, draft.type);
  const endpointRequired = !!spec && !spec.defaultEndpoint;
  const keyRequired = spec?.apiKeyRequired ?? true;

  // A newly opened provider starts clean: its draft and no errors from the last one.
  useEffect(() => {
    setDraft(provider ?? newProvider());
    setKeyVisible(false);
    fieldErrors.clear("title");
    fieldErrors.clear("apiKey");
    fieldErrors.clear("endpoint");
  }, [provider]);

  const updateDraft = (partial: Partial<LocalAIProvider>) => {
    setDraft((prev) => ({ ...prev, ...partial }));
    onChange();
  };

  // A name the admin has not written follows the service, so picking one is enough.
  const changeType = (type: InstanceSetting_AIProviderType) => {
    const followsType = !draft.title.trim() || draft.title === providerTypeLabel(draft.type);
    updateDraft({ type, title: followsType ? providerTypeLabel(type) : draft.title });
    fieldErrors.clear("endpoint");
    fieldErrors.clear("apiKey");
  };

  const isEditing = !!provider?.apiKeySet;
  // The server keeps a stored key only for the connection it was saved with.
  const reuseKey =
    isEditing && provider.type === draft.type && resolvedEndpoint(providerTypes, provider) === resolvedEndpoint(providerTypes, draft);
  const visibilityLabel = keyVisible ? t("auth.hide-password") : t("auth.show-password");

  // Saving needs a key where the service asks for one; the field says so instead of a disabled button staying silent.
  const hasKey = () => {
    if (!keyRequired || reuseKey || draft.apiKey.trim()) return true;
    // The error replaces the field's description, so it carries the reason itself when a stored key stopped applying.
    fieldErrors.set("apiKey", isEditing ? t("setting.ai.key-reentry") : t("setting.ai.api-key-required"));
    keyRef.current?.focus();
    return false;
  };

  // Missing fields show under the field, as in the other settings dialogs.
  const handleSave = () => {
    if (saving) return;
    if (!draft.title.trim()) {
      fieldErrors.set("title", t("setting.ai.provider-title-required"));
      titleRef.current?.focus();
      return;
    }
    if (endpointRequired && !draft.endpoint.trim()) {
      fieldErrors.set("endpoint", t("setting.ai.endpoint-required"));
      endpointRef.current?.focus();
      return;
    }
    if (!hasKey()) return;
    onSave(draft);
  };

  const endpointField = (
    <Field.Root key="endpoint" className="sm:col-span-2" invalid={!!fieldErrors.errors.endpoint}>
      <div className="flex items-baseline justify-between gap-2">
        <Field.Label>{t("setting.ai.endpoint")}</Field.Label>
        {!endpointRequired && <span className="mu-caption text-mu-text-secondary">{t("setting.ai.optional")}</span>}
      </div>
      <Input
        ref={endpointRef}
        type="url"
        inputMode="url"
        value={draft.endpoint}
        onChange={(e) => {
          updateDraft({ endpoint: e.target.value });
          fieldErrors.clear("endpoint");
        }}
        placeholder={spec?.defaultEndpoint || "https://"}
        spellCheck={false}
        autoCapitalize="off"
        autoComplete="off"
      />
      {fieldErrors.errors.endpoint ? (
        <Field.Error match>{fieldErrors.errors.endpoint}</Field.Error>
      ) : endpointRequired ? (
        draft.endpoint.trim() && (
          // Whether to include /v1 is the usual question; the resolved request URL answers it.
          <Field.Description className="wrap-anywhere">
            {t("setting.ai.request-url", { url: requestURL(draft.type, draft.endpoint) })}
          </Field.Description>
        )
      ) : (
        // A local server's address is explained below the form; "official endpoint" is a cloud notion.
        !spec?.local && <Field.Description>{t("setting.ai.endpoint-hint")}</Field.Description>
      )}
    </Field.Root>
  );

  const keyField = (
    <Field.Root key="apiKey" className="sm:col-span-2" invalid={!!fieldErrors.errors.apiKey}>
      <div className="flex items-baseline justify-between gap-2">
        <Field.Label>{t("setting.ai.api-key")}</Field.Label>
        {spec?.apiKeyUrl ? (
          <span className="shrink-0 whitespace-nowrap mu-caption">
            <Link href={spec.apiKeyUrl} target="_blank" rel="noopener noreferrer">
              {t("setting.ai.get-api-key")}
            </Link>
          </span>
        ) : (
          !keyRequired && <span className="mu-caption text-mu-text-secondary">{t("setting.ai.optional")}</span>
        )}
      </div>
      <Input
        ref={keyRef}
        type={keyVisible ? "text" : "password"}
        value={draft.apiKey}
        onChange={(e) => {
          updateDraft({ apiKey: e.target.value });
          fieldErrors.clear("apiKey");
        }}
        placeholder={reuseKey ? t("setting.ai.keep-api-key") : ""}
        // An API key is not a login: keep password managers from offering to fill or save it.
        autoComplete="off"
        data-1p-ignore
        data-lpignore="true"
        spellCheck={false}
        autoCapitalize="off"
        suffix={
          <Tooltip.Root>
            <Tooltip.Trigger
              render={
                <Button
                  variant="ghost"
                  size="xs"
                  icon={keyVisible ? <EyeOffIcon /> : <EyeIcon />}
                  aria-label={visibilityLabel}
                  aria-pressed={keyVisible}
                  onClick={() => setKeyVisible((visible) => !visible)}
                />
              }
            />
            <Tooltip.Popup>{visibilityLabel}</Tooltip.Popup>
          </Tooltip.Root>
        }
      />
      {reuseKey && hasKeyHint(draft) && <Field.Description>{t("setting.ai.current-key", { key: draft.apiKeyHint })}</Field.Description>}
      {isEditing && !reuseKey && <Field.Description>{t("setting.ai.key-reentry")}</Field.Description>}
      {fieldErrors.errors.apiKey && <Field.Error match>{fieldErrors.errors.apiKey}</Field.Error>}
    </Field.Root>
  );

  // A server the administrator runs, or an API memos does not know, is found by its address first.
  const addressFirst = endpointRequired || !!spec?.local;

  return (
    <Dialog.Root open={!!provider} onOpenChange={onOpenChange}>
      <Dialog.Popup closeLabel={t("common.close")} style={{ "--mu-dialog-width": "42rem" } as React.CSSProperties}>
        <Dialog.Title>{isEditing ? t("setting.ai.edit-provider") : t("setting.ai.add-provider")}</Dialog.Title>
        <Dialog.Description>{t("setting.ai.byok-storage-note")}</Dialog.Description>

        <form
          id={formId}
          noValidate
          className="flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            handleSave();
          }}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field.Root>
              <Field.Label>{t("setting.ai.provider-type")}</Field.Label>
              <Select.Root
                value={String(draft.type)}
                items={typeOptions}
                onValueChange={(value) => changeType(Number(value) as InstanceSetting_AIProviderType)}
              >
                <Select.Trigger className="w-full">
                  <Select.Value />
                </Select.Trigger>
                <Select.Popup>
                  {providerTypes.map((info, index) => {
                    const previous = providerTypes[index - 1];
                    // Cloud services, then servers the administrator runs, then compatible APIs.
                    // A compatible type is the one with no default endpoint.
                    const startsGroup = previous && (previous.local !== info.local || !previous.defaultEndpoint !== !info.defaultEndpoint);
                    return (
                      <Fragment key={info.type}>
                        {startsGroup && <Select.Separator />}
                        <Select.Item value={String(info.type)}>{providerTypeLabel(info.type)}</Select.Item>
                      </Fragment>
                    );
                  })}
                </Select.Popup>
              </Select.Root>
            </Field.Root>

            <Field.Root invalid={!!fieldErrors.errors.title}>
              <Field.Label>{t("setting.ai.provider-title")}</Field.Label>
              <Input
                ref={titleRef}
                value={draft.title}
                onChange={(e) => {
                  updateDraft({ title: e.target.value });
                  fieldErrors.clear("title");
                }}
                placeholder={providerTypeLabel(draft.type)}
              />
              {/* Configuration files refer to a provider by this ID. */}
              {isEditing && <p className="font-mono mu-caption text-mu-text-secondary">ID {draft.id}</p>}
              {fieldErrors.errors.title && <Field.Error match>{fieldErrors.errors.title}</Field.Error>}
            </Field.Root>

            {addressFirst ? [endpointField, keyField] : [keyField, endpointField]}
          </div>

          {/* The memos server makes the request, so localhost is that server, not the administrator's computer. */}
          {spec?.local && (
            <p className="rounded-mu-md bg-mu-well px-3 py-2 mu-caption text-mu-text-secondary">{t("setting.ai.local-endpoint-hint")}</p>
          )}

          {/* The server lists the models of a new or changed connection before saving it. */}
          <div role="status" aria-atomic="true" className="mu-caption">
            {saving && !reuseKey && <p className="text-mu-text-secondary">{t("setting.ai.checking-connection")}</p>}
            {error && !saving && (
              <p className="flex items-baseline gap-1.5 text-mu-danger">
                <CircleAlertIcon aria-hidden className="mu-icon-sm shrink-0 translate-y-0.5" />
                <span className="min-w-0 wrap-anywhere">{error}</span>
              </p>
            )}
          </div>
        </form>
        <Dialog.Footer>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          <Button variant="primary" type="submit" form={formId} loading={saving}>
            {t("common.save")}
          </Button>
        </Dialog.Footer>
      </Dialog.Popup>
    </Dialog.Root>
  );
};

/** Where a compatible type's requests go: the OpenAI SDK appends /chat/completions, Anthropic's /v1/messages. */
const requestURL = (type: InstanceSetting_AIProviderType, endpoint: string) => {
  const base = endpoint.trim().replace(/\/+$/, "");
  return type === InstanceSetting_AIProviderType.ANTHROPIC_COMPATIBLE ? `${base}/v1/messages` : `${base}/chat/completions`;
};

export default AISection;
