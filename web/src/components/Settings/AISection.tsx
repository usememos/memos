import { create } from "@bufbuild/protobuf";
import { Button, Dialog, Field, Input, Menu, Select, Textarea, Tooltip } from "@usememos/ui";
import { isEqual } from "lodash-es";
import { CircleAlertIcon, EllipsisIcon, EyeIcon, EyeOffIcon, PlayIcon, PlusIcon } from "lucide-react";
import { type ReactNode, useEffect, useId, useMemo, useRef, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import ConfirmDialog from "@/components/ConfirmDialog";
import { useInstance } from "@/contexts/InstanceContext";
import { isFieldManaged, useManagedResource } from "@/hooks/useConfigurationQueries";
import { useFieldErrors } from "@/hooks/useFieldErrors";
import { useOverflowTitle } from "@/hooks/useOverflowTitle";
import i18n from "@/i18n";
import { getErrorMessage } from "@/lib/error";
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

const providerTypeOptions = [InstanceSetting_AIProviderType.OPENAI, InstanceSetting_AIProviderType.GEMINI];

/** The OpenAI type also serves the many services that speak its API, so it is named for that. Gemini is a product name. */
const useProviderTypeLabel = () => {
  const t = useTranslate();
  return (type: InstanceSetting_AIProviderType) => {
    switch (type) {
      case InstanceSetting_AIProviderType.OPENAI:
        return t("setting.ai.provider-type-openai");
      case InstanceSetting_AIProviderType.GEMINI:
        return "Gemini";
      default:
        return "-";
    }
  };
};

/** A model each protocol's own service offers for the capability, shown as an example of what to type. */
const modelExamples = {
  transcription: (type?: InstanceSetting_AIProviderType) =>
    type === InstanceSetting_AIProviderType.GEMINI ? "gemini-2.5-flash" : "gpt-transcribe",
  textGeneration: (type?: InstanceSetting_AIProviderType) =>
    type === InstanceSetting_AIProviderType.GEMINI ? "gemini-2.5-flash" : "gpt-5-mini",
};

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

  const affectedFeatures: string[] = [];
  if (deleteTarget && originalSetting.transcription?.providerId === deleteTarget.id)
    affectedFeatures.push(t("setting.ai.transcription-title"));
  if (deleteTarget && originalSetting.textGeneration?.providerId === deleteTarget.id)
    affectedFeatures.push(t("setting.ai.text-generation-title"));

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
              render: (_, provider: LocalAIProvider) => <span className="text-mu-text">{provider.title}</span>,
            },
            {
              key: "type",
              header: t("setting.ai.provider-type"),
              render: (_, provider: LocalAIProvider) => <span>{providerTypeLabel(provider.type)}</span>,
            },
            {
              key: "endpoint",
              header: t("setting.ai.endpoint"),
              render: (_, provider: LocalAIProvider) => <EndpointCell text={provider.endpoint || t("setting.ai.default-endpoint")} />,
            },
            {
              key: "apiKeySet",
              header: t("setting.ai.api-key"),
              render: (_, provider: LocalAIProvider) =>
                !provider.apiKeySet ? (
                  "-"
                ) : hasKeyHint(provider) ? (
                  <span className="font-mono mu-caption">{provider.apiKeyHint}</span>
                ) : (
                  t("setting.ai.configured")
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
  locked,
  noneLabel,
  onChange,
}: {
  providers: LocalAIProvider[];
  providerId: string;
  locked: boolean;
  noneLabel: string;
  onChange: (id: string) => void;
}) {
  const t = useTranslate();
  const noProviders = providers.length === 0;
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
          {providerOptions.map((option) => (
            <Select.Item key={option.value} value={option.value}>
              {option.label}
            </Select.Item>
          ))}
        </Select.Popup>
      </Select.Root>
      {noProviders && <Field.Description>{t("setting.ai.no-providers")}</Field.Description>}
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
  const canSave = !locked && !busy && changed && (!providerId || provider?.apiKeySet);
  const example = modelExamples.textGeneration(provider?.type);

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
              noneLabel={t("setting.ai.text-generation-disabled")}
              onChange={(id) => {
                // The typed model stays: it is the writer's input, and clearing it would be a silent loss.
                setSelectedId(id);
                fieldErrors.clear("model");
              }}
            />
            {providerId && (
              <Field.Root className="sm:col-span-2" invalid={!!fieldErrors.errors.model}>
                <Field.Label>{t("setting.ai.transcription-model")}</Field.Label>
                <Input
                  ref={modelRef}
                  value={model}
                  placeholder={example}
                  aria-required
                  maxLength={256}
                  spellCheck={false}
                  autoCapitalize="off"
                  autoComplete="off"
                  disabled={locked}
                  // Read-only rather than disabled while saving: disabling the focused field would drop keyboard focus.
                  readOnly={saving}
                  onChange={(event) => {
                    setModel(event.target.value);
                    fieldErrors.clear("model");
                  }}
                />
                <Field.Description>{t("setting.ai.model-help", { example })}</Field.Description>
                {fieldErrors.errors.model && <Field.Error match>{fieldErrors.errors.model}</Field.Error>}
              </Field.Root>
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
  const example = modelExamples.transcription(referencedProvider?.type);

  const update = (partial: Partial<LocalTranscription>) => {
    onChange({ ...transcription, ...partial });
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-3xl">
      <ProviderField
        providers={providers}
        providerId={transcription.providerId}
        locked={locked || saving}
        noneLabel={t("setting.ai.transcription-no-provider")}
        onChange={(providerId) => update({ providerId })}
      />

      {/* The options belong to a provider, so they appear with one instead of sitting disabled. */}
      {transcription.providerId && (
        <>
          <Field.Root className="sm:col-span-2" invalid={!!modelError}>
            <Field.Label>{t("setting.ai.transcription-model")}</Field.Label>
            <Input
              ref={modelRef}
              value={transcription.model}
              onChange={(e) => update({ model: e.target.value })}
              placeholder={example}
              aria-required
              disabled={locked}
              readOnly={saving}
              maxLength={256}
              spellCheck={false}
              autoCapitalize="off"
              autoComplete="off"
            />
            <Field.Description>{t("setting.ai.model-help", { example })}</Field.Description>
            {modelError && <Field.Error match>{modelError}</Field.Error>}
          </Field.Root>

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
  const formId = useId();
  const titleRef = useRef<HTMLInputElement>(null);
  const keyRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState<LocalAIProvider>(() => provider ?? newProvider());
  const [keyVisible, setKeyVisible] = useState(false);
  const fieldErrors = useFieldErrors<"title" | "apiKey">();
  const typeOptions = providerTypeOptions.map((type) => ({ value: String(type), label: providerTypeLabel(type) }));

  // A newly opened provider starts clean: its draft and no errors from the last one.
  useEffect(() => {
    setDraft(provider ?? newProvider());
    setKeyVisible(false);
    fieldErrors.clear("title");
    fieldErrors.clear("apiKey");
  }, [provider]);

  const updateDraft = (partial: Partial<LocalAIProvider>) => {
    setDraft((prev) => ({ ...prev, ...partial }));
    onChange();
  };

  const isEditing = !!provider?.apiKeySet;
  const previousEndpoint = (provider?.endpoint.trim() || getDefaultEndpointPlaceholder(provider?.type ?? draft.type)).replace(/\/+$/, "");
  const endpoint = (draft.endpoint.trim() || getDefaultEndpointPlaceholder(draft.type)).replace(/\/+$/, "");
  // The server keeps a stored key only for the connection it was saved with.
  const reuseKey = isEditing && provider.type === draft.type && previousEndpoint === endpoint;
  const visibilityLabel = keyVisible ? t("auth.hide-password") : t("auth.show-password");

  // Saving needs a key; the field says so instead of a disabled button staying silent.
  const hasKey = () => {
    if (reuseKey || draft.apiKey.trim()) return true;
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
    if (!hasKey()) return;
    onSave(draft);
  };

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
            <Field.Root invalid={!!fieldErrors.errors.title}>
              <Field.Label>{t("setting.ai.provider-title")}</Field.Label>
              <Input
                ref={titleRef}
                value={draft.title}
                onChange={(e) => {
                  updateDraft({ title: e.target.value });
                  fieldErrors.clear("title");
                }}
                placeholder="OpenAI"
              />
              {/* Configuration files refer to a provider by this ID. */}
              {isEditing && <p className="font-mono mu-caption text-mu-text-secondary">ID {draft.id}</p>}
              {fieldErrors.errors.title && <Field.Error match>{fieldErrors.errors.title}</Field.Error>}
            </Field.Root>

            <Field.Root>
              <Field.Label>{t("setting.ai.provider-type")}</Field.Label>
              <Select.Root
                value={String(draft.type)}
                items={typeOptions}
                onValueChange={(value) => updateDraft({ type: Number(value) as InstanceSetting_AIProviderType })}
              >
                <Select.Trigger className="w-full">
                  <Select.Value />
                </Select.Trigger>
                <Select.Popup>
                  {typeOptions.map((option) => (
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
                type="url"
                inputMode="url"
                value={draft.endpoint}
                onChange={(e) => updateDraft({ endpoint: e.target.value })}
                placeholder={getDefaultEndpointPlaceholder(draft.type)}
                spellCheck={false}
                autoCapitalize="off"
                autoComplete="off"
              />
              <Field.Description>{t("setting.ai.endpoint-hint")}</Field.Description>
            </Field.Root>

            <Field.Root className="sm:col-span-2" invalid={!!fieldErrors.errors.apiKey}>
              <Field.Label>{t("setting.ai.api-key")}</Field.Label>
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
              {reuseKey && hasKeyHint(draft) && (
                <Field.Description>{t("setting.ai.current-key", { key: draft.apiKeyHint })}</Field.Description>
              )}
              {isEditing && !reuseKey && <Field.Description>{t("setting.ai.key-reentry")}</Field.Description>}
              {fieldErrors.errors.apiKey && <Field.Error match>{fieldErrors.errors.apiKey}</Field.Error>}
            </Field.Root>
          </div>

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
