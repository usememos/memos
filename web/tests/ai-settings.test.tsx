import { create } from "@bufbuild/protobuf";
import { BinaryWriter } from "@bufbuild/protobuf/wire";
import { Code, ConnectError } from "@connectrpc/connect";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import AISection from "@/components/Settings/AISection";
import { aiServiceClient } from "@/connect";
import {
  AICapabilityKind,
  AIProviderTypeInfoSchema,
  SuggestTagsResponseSchema,
  TranscribeResponseSchema,
} from "@/types/proto/api/ai_service_pb";
import {
  type InstanceSetting,
  InstanceSetting_AISettingSchema,
  InstanceSetting_AIProviderType as ProviderType,
} from "@/types/proto/api/instance_service_pb";

const updateSetting = vi.fn<(setting: InstanceSetting) => Promise<void>>();
const fetchSetting = vi.fn<() => Promise<void>>();
let aiSetting = create(InstanceSetting_AISettingSchema);

vi.mock("@/contexts/InstanceContext", () => ({ useInstance: () => ({ aiSetting, updateSetting, fetchSetting }) }));
vi.mock("@/hooks/useConfigurationQueries", () => ({ useManagedResource: () => undefined, isFieldManaged: () => false }));
vi.mock("@/hooks/useUserQueries", () => ({ useTagCounts: () => ({ data: { garden: 3, travel: 1 } }) }));

// The server's catalog, trimmed to the types these tests use.
const text = (suggestedModel = "") => ({ kind: AICapabilityKind.TEXT_GENERATION, suggestedModel });
const speech = (suggestedModel = "") => ({ kind: AICapabilityKind.TRANSCRIPTION, suggestedModel });
const catalog = [
  create(AIProviderTypeInfoSchema, {
    type: ProviderType.OPENAI,
    defaultEndpoint: "https://api.openai.com/v1",
    apiKeyRequired: true,
    apiKeyUrl: "https://platform.openai.com/api-keys",
    capabilities: [text("gpt-5-mini"), speech("gpt-transcribe")],
  }),
  create(AIProviderTypeInfoSchema, {
    type: ProviderType.ANTHROPIC,
    defaultEndpoint: "https://api.anthropic.com",
    apiKeyRequired: true,
    capabilities: [text("claude")],
  }),
  create(AIProviderTypeInfoSchema, {
    type: ProviderType.OLLAMA,
    defaultEndpoint: "http://localhost:11434/v1",
    local: true,
    capabilities: [text()],
  }),
  create(AIProviderTypeInfoSchema, { type: ProviderType.OPENAI_COMPATIBLE, capabilities: [text(), speech()] }),
];
let modelListing: { isPending: boolean; error: unknown; data?: string[] } = { isPending: false, error: null, data: [] };
vi.mock("@/hooks/useAIQueries", () => ({ useAIProviderTypes: () => catalog, useAIProviderModels: () => modelListing }));

beforeEach(() => {
  aiSetting = create(InstanceSetting_AISettingSchema);
  modelListing = { isPending: false, error: null, data: [] };
});

const form = (name: string) => within(screen.getByRole("form", { name }));

/** The AI setting sent by the latest save. */
const lastSavedAISetting = () => {
  const value = updateSetting.mock.lastCall?.[0].value;
  if (value?.case !== "aiSetting") throw new Error("Expected AI settings");
  return value.value;
};

async function chooseProvider(section: string, name: string) {
  fireEvent.click(form(section).getByRole("combobox", { name: "Provider" }));
  const option = await screen.findByRole("option", { name });
  fireEvent.pointerDown(option, { pointerType: "mouse" });
  fireEvent.click(option);
}

it("uses the saved provider and its masked key when selecting it for transcription without reloading", async () => {
  const pending = Promise.withResolvers<void>();
  fetchSetting.mockReturnValueOnce(pending.promise);
  const { rerender } = render(<AISection />);
  fireEvent.click(screen.getByRole("button", { name: "Add provider" }));
  const dialog = within(await screen.findByRole("dialog"));
  fireEvent.change(dialog.getByLabelText("Provider name"), { target: { value: "Voice" } });
  fireEvent.change(dialog.getByLabelText("API key"), { target: { value: "test-provider-key" } });
  fireEvent.click(dialog.getByRole("button", { name: "Save" }));

  const request = updateSetting.mock.calls[0][0].value;
  if (request.case !== "aiSetting") throw new Error("Expected AI settings");
  const [provider] = request.value.providers;
  expect(provider.apiKey).toBe("test-provider-key");
  aiSetting = create(InstanceSetting_AISettingSchema, {
    providers: [{ ...provider, apiKey: "", apiKeySet: true, apiKeyHint: "test...-key" }],
  });
  // The instance context can publish the update response before the save callback completes.
  rerender(<AISection />);
  await act(async () => pending.resolve());
  // The saved provider shows its live status in the table.
  expect(screen.getByText("Connected")).toBeInTheDocument();

  await chooseProvider("Transcription", "Voice");
  // A capability that is on names a model: saving without one is refused at the field.
  const saves = updateSetting.mock.calls.length;
  fireEvent.click(form("Transcription").getByRole("button", { name: "Save" }));
  expect(form("Transcription").getByText("Model is required.")).toBeVisible();
  expect(form("Transcription").getByRole("combobox", { name: "Model" })).toHaveFocus();
  expect(updateSetting.mock.calls).toHaveLength(saves);
  fireEvent.change(form("Transcription").getByRole("combobox", { name: "Model" }), { target: { value: "speech" } });
  fireEvent.click(form("Transcription").getByRole("button", { name: "Save" }));
  const saved = lastSavedAISetting();
  expect(saved).toMatchObject({
    providers: [{ id: provider.id, apiKey: "" }],
    transcription: { providerId: provider.id, model: "speech" },
  });
  // The setting is replaced whole, so a capability that is off is sent as unset.
  expect(saved.textGeneration).toBeUndefined();
});

it("saves text generation with an existing key, keeps the transcription draft separate, and can disable the feature", async () => {
  const pending = Promise.withResolvers<void>();
  updateSetting.mockReturnValueOnce(pending.promise);
  const provider = { id: "existing", title: "OpenAI", type: ProviderType.OPENAI, apiKeySet: true };
  aiSetting = create(InstanceSetting_AISettingSchema, {
    providers: [provider],
    transcription: { providerId: provider.id, model: "speech" },
  });
  const { rerender } = render(<AISection />);
  fireEvent.change(form("Transcription").getByRole("combobox", { name: "Model" }), { target: { value: "speech draft" } });
  const text = () => form("Text generation");
  // A feature's options appear with its provider.
  expect(text().queryByRole("combobox", { name: "Model" })).toBeNull();
  await chooseProvider("Text generation", provider.title);
  fireEvent.click(text().getByRole("button", { name: "Save" }));
  expect(text().getByText("Model is required.")).toBeVisible();
  expect(text().getByRole("combobox", { name: "Model" })).toHaveFocus();
  expect(updateSetting).not.toHaveBeenCalled();
  fireEvent.change(text().getByRole("combobox", { name: "Model" }), { target: { value: " text-model " } });
  fireEvent.click(text().getByRole("button", { name: "Save" }));
  expect(text().getByRole("combobox", { name: "Model" })).toHaveAttribute("readonly");
  expect(text().getByRole("combobox", { name: "Model" })).toBeEnabled();
  expect(text().getByRole("combobox", { name: "Provider" })).toBeDisabled();
  expect(text().getByRole("button", { name: "Save" })).toHaveAttribute("aria-busy", "true");
  expect(form("Transcription").getByRole("combobox", { name: "Model" })).toBeEnabled();
  await act(async () => pending.resolve());
  await waitFor(() => expect(fetchSetting).toHaveBeenCalled());
  const request = updateSetting.mock.calls[0][0].value;
  if (request.case !== "aiSetting") throw new Error("Expected AI settings");
  expect(request.value.textGeneration).toMatchObject({ providerId: provider.id, model: "text-model" });
  expect(request.value.providers[0]).toMatchObject({ id: provider.id, apiKey: "" });
  // The whole setting is sent: transcription as saved, not the draft being typed beside it.
  expect(request.value.transcription).toMatchObject({ providerId: provider.id, model: "speech" });

  const modelField = text().getByRole("combobox", { name: "Model" });
  aiSetting = create(InstanceSetting_AISettingSchema, { ...aiSetting, textGeneration: request.value.textGeneration });
  rerender(<AISection />);
  // The saved config is adopted in place: a remount would drop keyboard focus.
  expect(text().getByRole("combobox", { name: "Model" })).toBe(modelField);
  expect(form("Transcription").getByRole("combobox", { name: "Model" })).toHaveValue("speech draft");
  expect(text().getByRole("combobox", { name: "Model" })).toHaveValue("text-model");
  expect(text().getByRole("button", { name: "Save" })).toBeDisabled();
  await chooseProvider("Text generation", "None — text generation disabled");
  fireEvent.click(text().getByRole("button", { name: "Save" }));
  await waitFor(() => expect(updateSetting).toHaveBeenCalledTimes(2));
  const disabled = lastSavedAISetting();
  expect(disabled).toMatchObject({ transcription: { providerId: provider.id, model: "speech" } });
  expect(disabled.textGeneration).toBeUndefined();
});

it("clears both saved feature bindings when their shared provider is deleted", async () => {
  aiSetting = create(InstanceSetting_AISettingSchema, {
    providers: [{ id: "p", title: "Shared", type: ProviderType.OPENAI, apiKeySet: true }],
    transcription: { providerId: "p", model: "speech" },
    textGeneration: { providerId: "p", model: "text" },
  });
  render(<AISection />);
  fireEvent.click(screen.getByRole("button", { name: /More: Shared/ }));
  fireEvent.click(await screen.findByRole("menuitem", { name: "Delete" }));
  const dialog = await screen.findByRole("alertdialog");
  expect(dialog).toHaveAccessibleDescription("Deleting this provider will disable Transcription and Text generation.");
  fireEvent.click(within(dialog).getByRole("button", { name: "Delete" }));
  await waitFor(() => expect(updateSetting).toHaveBeenCalled());
  const remaining = lastSavedAISetting();
  expect(remaining).toMatchObject({ providers: [] });
  // A capability served by the deleted provider is turned off in the same update.
  expect(remaining.transcription).toBeUndefined();
  expect(remaining.textGeneration).toBeUndefined();
});

it("keeps the provider dialog open with the reason when the server refuses the connection", async () => {
  aiSetting = create(InstanceSetting_AISettingSchema);
  render(<AISection />);
  fireEvent.click(screen.getByRole("button", { name: "Add provider" }));
  const dialog = within(await screen.findByRole("dialog"));
  fireEvent.change(dialog.getByLabelText("Provider name"), { target: { value: "Draft" } });
  fireEvent.change(dialog.getByLabelText("API key"), { target: { value: "wrong-key" } });
  updateSetting.mockRejectedValueOnce(new Error("the provider rejected the API key"));
  fireEvent.click(dialog.getByRole("button", { name: "Save" }));
  expect(await dialog.findByText("the provider rejected the API key")).toBeVisible();
  expect(screen.getByRole("dialog")).toBeInTheDocument();
  // The reason describes the draft that was sent; editing it clears the reason.
  fireEvent.change(dialog.getByLabelText("API key"), { target: { value: "right-key" } });
  expect(dialog.queryByText("the provider rejected the API key")).toBeNull();
  fireEvent.click(dialog.getByRole("button", { name: "Save" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(lastSavedAISetting().providers[0]).toMatchObject({ title: "Draft", apiKey: "right-key" });
});

it("tries the saved settings in each feature's playground", async () => {
  const suggest = vi.spyOn(aiServiceClient, "suggestTags");
  const transcribe = vi.spyOn(aiServiceClient, "transcribe");
  aiSetting = create(InstanceSetting_AISettingSchema, {
    providers: [{ id: "p", title: "Voice", type: ProviderType.OPENAI, apiKeySet: true }],
    transcription: { providerId: "p", model: "speech" },
    textGeneration: { providerId: "p", model: "saved" },
  });
  render(<AISection />);

  const text = form("Text generation");
  fireEvent.change(text.getByRole("combobox", { name: "Model" }), { target: { value: "draft" } });
  fireEvent.click(text.getByRole("button", { name: "Try it" }));
  const tags = within(await screen.findByRole("dialog", { name: "Try tag suggestions" }));
  expect(tags.getByText("Voice · saved")).toBeVisible();
  expect(tags.getByText("Uses the saved settings. Save to try your changes.")).toBeVisible();
  expect(tags.getByRole("button", { name: "Suggest tags" })).toBeDisabled();
  fireEvent.change(tags.getByLabelText("Note"), { target: { value: "Planted tomatoes today." } });
  suggest.mockResolvedValueOnce(create(SuggestTagsResponseSchema, { tags: ["garden"] }));
  fireEvent.click(tags.getByRole("button", { name: "Suggest tags" }));
  expect(await tags.findByText("garden")).toBeVisible();
  // The call the composer makes, with the writer's own tags as candidates.
  expect(suggest.mock.lastCall?.[0]).toMatchObject({ content: "Planted tomatoes today.", candidateTags: ["garden", "travel"] });
  suggest.mockRejectedValueOnce(new Error("the provider rejected the API key"));
  fireEvent.click(tags.getByRole("button", { name: "Suggest tags" }));
  expect(await tags.findByText("the provider rejected the API key")).toBeVisible();
  fireEvent.click(tags.getByRole("button", { name: "Close" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

  fireEvent.click(form("Transcription").getByRole("button", { name: "Try it" }));
  const audio = within(await screen.findByRole("dialog", { name: "Try transcription" }));
  expect(audio.getByText("The transcript will appear here")).toBeVisible();
  transcribe.mockResolvedValueOnce(create(TranscribeResponseSchema, { text: "Water the tomatoes." }));
  const input = screen.getByRole("dialog").querySelector<HTMLInputElement>('input[type="file"]')!;
  fireEvent.change(input, { target: { files: [new File(["RIFF"], "note.wav", { type: "audio/wav" })] } });
  expect(await audio.findByText("Water the tomatoes.")).toBeVisible();
  expect(transcribe.mock.lastCall?.[0]).toMatchObject({ audio: { filename: "note.wav", contentType: "audio/wav" } });
  expect(audio.getByRole("button", { name: "Copy transcript" })).toBeVisible();
  expect(updateSetting).not.toHaveBeenCalled();
  suggest.mockRestore();
  transcribe.mockRestore();
});

it("offers a playground only for a saved capability", () => {
  aiSetting = create(InstanceSetting_AISettingSchema, {
    providers: [{ id: "p", title: "Voice", type: ProviderType.OPENAI, apiKeySet: true }],
  });
  render(<AISection />);
  expect(screen.queryByRole("button", { name: "Try it" })).toBeNull();
});

it("says why a stored key no longer applies, and saves the provider dialog with Enter", async () => {
  aiSetting = create(InstanceSetting_AISettingSchema, {
    providers: [
      {
        id: "p",
        title: "Voice",
        type: ProviderType.OPENAI,
        endpoint: "https://proxy.example.com/v1",
        apiKeySet: true,
        apiKeyHint: "sk-a...wxyz",
      },
    ],
  });
  render(<AISection />);
  expect(screen.queryByText("p")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: /More: Voice/ }));
  fireEvent.click(await screen.findByRole("menuitem", { name: "Edit" }));
  const dialog = within(await screen.findByRole("dialog"));
  expect(dialog.getByText("Current key: sk-a...wxyz")).toBeVisible();
  expect(dialog.getByText("ID p")).toBeVisible();

  fireEvent.change(dialog.getByLabelText("Endpoint"), { target: { value: "https://other.example.com/v1" } });
  expect(dialog.queryByText(/Current key/)).toBeNull();
  expect(dialog.getByText("Changing the type or endpoint needs the API key again.")).toBeVisible();
  const saves = updateSetting.mock.calls.length;
  fireEvent.click(dialog.getByRole("button", { name: "Save" }));
  expect(dialog.getByLabelText("API key")).toBeInvalid();
  expect(dialog.getAllByText("Changing the type or endpoint needs the API key again.").length).toBeGreaterThan(0);
  expect(dialog.getByLabelText("API key")).toHaveFocus();
  expect(updateSetting.mock.calls).toHaveLength(saves);

  fireEvent.change(dialog.getByLabelText("API key"), { target: { value: "new-key" } });
  fireEvent.submit(dialog.getByLabelText("API key").closest("form")!);
  await waitFor(() =>
    expect(updateSetting.mock.lastCall?.[0].value.value).toMatchObject({
      providers: [{ id: "p", endpoint: "https://other.example.com/v1", apiKey: "new-key" }],
    }),
  );
});

it("offers each feature only the providers that can serve it", async () => {
  aiSetting = create(InstanceSetting_AISettingSchema, {
    providers: [
      { id: "o", title: "OpenAI", type: ProviderType.OPENAI, apiKeySet: true },
      { id: "c", title: "Claude", type: ProviderType.ANTHROPIC, apiKeySet: true },
    ],
  });
  modelListing = { isPending: false, error: null, data: ["gpt-4o-transcribe", "gpt-transcribe"] };
  render(<AISection />);

  fireEvent.click(form("Transcription").getByRole("combobox", { name: "Provider" }));
  expect(await screen.findByRole("option", { name: "OpenAI" })).not.toHaveAttribute("aria-disabled", "true");
  // Anthropic has no speech-to-text: it is listed, but cannot be picked.
  expect(screen.getByText("Can't transcribe")).toBeVisible();
  expect(screen.getByRole("option", { name: "Claude" })).toHaveAttribute("aria-disabled", "true");
  const option = screen.getByRole("option", { name: "OpenAI" });
  fireEvent.pointerDown(option, { pointerType: "mouse" });
  fireEvent.click(option);

  // The model field suggests the type's model and offers what the provider lists.
  const model = form("Transcription").getByRole("combobox", { name: "Model" });
  expect(model).toHaveAttribute("placeholder", "gpt-transcribe");
  // Any ID can be typed, listed or not.
  fireEvent.change(model, { target: { value: "my-whisper" } });
  fireEvent.click(form("Transcription").getByRole("button", { name: "Save" }));
  await waitFor(() => expect(lastSavedAISetting().transcription).toMatchObject({ providerId: "o", model: "my-whisper" }));
});

/** A failed AI call as the server sends it: a fixed message and an ErrorInfo reason. */
const aiFailure = (reason: string, message: string) => {
  const error = new ConnectError(message, Code.FailedPrecondition);
  error.details.push({ type: "google.rpc.ErrorInfo", value: new BinaryWriter().tag(1, 2).string(reason).finish() });
  return error;
};

it("names what is wrong with a saved provider", () => {
  aiSetting = create(InstanceSetting_AISettingSchema, { providers: [{ id: "o", title: "Local", type: ProviderType.OLLAMA }] });
  modelListing = { isPending: false, error: new ConnectError("could not connect"), data: undefined };
  const { unmount } = render(<AISection />);
  expect(screen.getByText("Error")).toBeVisible();
  unmount();

  // Exhausted credit is the account's state, not a broken connection.
  modelListing = { isPending: false, error: aiFailure("AI_PROVIDER_QUOTA_EXHAUSTED", "out of credit"), data: undefined };
  render(<AISection />);
  expect(screen.getByText("Out of credit")).toBeVisible();
});

it("asks a local server for its address first and needs no key", async () => {
  render(<AISection />);
  fireEvent.click(screen.getByRole("button", { name: "Add provider" }));
  const dialog = within(await screen.findByRole("dialog"));
  // A cloud service links to where its key is made.
  expect(dialog.getByRole("link", { name: "Get an API key" })).toHaveAttribute("href", "https://platform.openai.com/api-keys");

  fireEvent.click(dialog.getByRole("combobox", { name: "Provider type" }));
  const ollama = await screen.findByRole("option", { name: "Ollama" });
  fireEvent.pointerDown(ollama, { pointerType: "mouse" });
  fireEvent.click(ollama);
  // The name follows the service until it is edited, and localhost is explained.
  expect(dialog.getByLabelText("Provider name")).toHaveValue("Ollama");
  expect(dialog.getByText(/localhost means that server/)).toBeVisible();
  const fields = dialog.getAllByRole("textbox").map((field) => field.getAttribute("type") ?? "text");
  expect(fields.indexOf("url")).toBeLessThan(fields.length);
  fireEvent.click(dialog.getByRole("button", { name: "Save" }));
  await waitFor(() => expect(lastSavedAISetting().providers[0]).toMatchObject({ type: ProviderType.OLLAMA, title: "Ollama", apiKey: "" }));
});

it("requires the address of a compatible API and shows where requests go", async () => {
  render(<AISection />);
  fireEvent.click(screen.getByRole("button", { name: "Add provider" }));
  const dialog = within(await screen.findByRole("dialog"));
  fireEvent.click(dialog.getByRole("combobox", { name: "Provider type" }));
  const compatible = await screen.findByRole("option", { name: "OpenAI-compatible" });
  fireEvent.pointerDown(compatible, { pointerType: "mouse" });
  fireEvent.click(compatible);
  const saves = updateSetting.mock.calls.length;
  fireEvent.click(dialog.getByRole("button", { name: "Save" }));
  expect(dialog.getByText("Endpoint is required.")).toBeVisible();
  expect(dialog.getByLabelText("Endpoint")).toHaveFocus();
  expect(updateSetting.mock.calls).toHaveLength(saves);
  fireEvent.change(dialog.getByLabelText("Endpoint"), { target: { value: "http://gpu-box:8000/v1/" } });
  expect(dialog.getByText("Requests go to http://gpu-box:8000/v1/chat/completions")).toBeVisible();
});
