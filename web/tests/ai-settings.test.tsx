import { create } from "@bufbuild/protobuf";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import AISection from "@/components/Settings/AISection";
import { aiServiceClient } from "@/connect";
import { SuggestTagsResponseSchema, TranscribeResponseSchema } from "@/types/proto/api/ai_service_pb";
import { type InstanceSetting, InstanceSetting_AISettingSchema } from "@/types/proto/api/instance_service_pb";

const updateSetting = vi.fn<(setting: InstanceSetting) => Promise<void>>();
const fetchSetting = vi.fn<() => Promise<void>>();
let aiSetting = create(InstanceSetting_AISettingSchema);

vi.mock("@/contexts/InstanceContext", () => ({ useInstance: () => ({ aiSetting, updateSetting, fetchSetting }) }));
vi.mock("@/hooks/useConfigurationQueries", () => ({ useManagedResource: () => undefined, isFieldManaged: () => false }));
vi.mock("@/hooks/useUserQueries", () => ({ useTagCounts: () => ({ data: { garden: 3, travel: 1 } }) }));

beforeEach(() => {
  aiSetting = create(InstanceSetting_AISettingSchema);
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
  expect(screen.getByText("test...-key")).toBeInTheDocument();

  await chooseProvider("Transcription", "Voice");
  // A capability that is on names a model: saving without one is refused at the field.
  const saves = updateSetting.mock.calls.length;
  fireEvent.click(form("Transcription").getByRole("button", { name: "Save" }));
  expect(form("Transcription").getByText("Model is required.")).toBeVisible();
  expect(form("Transcription").getByLabelText("Model")).toHaveFocus();
  expect(updateSetting.mock.calls).toHaveLength(saves);
  fireEvent.change(form("Transcription").getByLabelText("Model"), { target: { value: "speech" } });
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
  const provider = { id: "existing", title: "OpenAI", apiKeySet: true };
  aiSetting = create(InstanceSetting_AISettingSchema, {
    providers: [provider],
    transcription: { providerId: provider.id, model: "speech" },
  });
  const { rerender } = render(<AISection />);
  fireEvent.change(form("Transcription").getByLabelText("Model"), { target: { value: "speech draft" } });
  const text = () => form("Text generation");
  // A feature's options appear with its provider.
  expect(text().queryByLabelText("Model")).toBeNull();
  await chooseProvider("Text generation", provider.title);
  fireEvent.click(text().getByRole("button", { name: "Save" }));
  expect(text().getByText("Model is required.")).toBeVisible();
  expect(text().getByLabelText("Model")).toHaveFocus();
  expect(updateSetting).not.toHaveBeenCalled();
  fireEvent.change(text().getByLabelText("Model"), { target: { value: " text-model " } });
  fireEvent.click(text().getByRole("button", { name: "Save" }));
  expect(text().getByLabelText("Model")).toHaveAttribute("readonly");
  expect(text().getByLabelText("Model")).toBeEnabled();
  expect(text().getByRole("combobox")).toBeDisabled();
  expect(text().getByRole("button", { name: "Save" })).toHaveAttribute("aria-busy", "true");
  expect(form("Transcription").getByLabelText("Model")).toBeEnabled();
  await act(async () => pending.resolve());
  await waitFor(() => expect(fetchSetting).toHaveBeenCalled());
  const request = updateSetting.mock.calls[0][0].value;
  if (request.case !== "aiSetting") throw new Error("Expected AI settings");
  expect(request.value.textGeneration).toMatchObject({ providerId: provider.id, model: "text-model" });
  expect(request.value.providers[0]).toMatchObject({ id: provider.id, apiKey: "" });
  // The whole setting is sent: transcription as saved, not the draft being typed beside it.
  expect(request.value.transcription).toMatchObject({ providerId: provider.id, model: "speech" });

  const modelField = text().getByLabelText("Model");
  aiSetting = create(InstanceSetting_AISettingSchema, { ...aiSetting, textGeneration: request.value.textGeneration });
  rerender(<AISection />);
  // The saved config is adopted in place: a remount would drop keyboard focus.
  expect(text().getByLabelText("Model")).toBe(modelField);
  expect(form("Transcription").getByLabelText("Model")).toHaveValue("speech draft");
  expect(text().getByLabelText("Model")).toHaveValue("text-model");
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
    providers: [{ id: "p", title: "Shared", apiKeySet: true }],
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
    providers: [{ id: "p", title: "Voice", apiKeySet: true }],
    transcription: { providerId: "p", model: "speech" },
    textGeneration: { providerId: "p", model: "saved" },
  });
  render(<AISection />);

  const text = form("Text generation");
  fireEvent.change(text.getByLabelText("Model"), { target: { value: "draft" } });
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
  aiSetting = create(InstanceSetting_AISettingSchema, { providers: [{ id: "p", title: "Voice", apiKeySet: true }] });
  render(<AISection />);
  expect(screen.queryByRole("button", { name: "Try it" })).toBeNull();
});

it("says why a stored key no longer applies, and saves the provider dialog with Enter", async () => {
  aiSetting = create(InstanceSetting_AISettingSchema, {
    providers: [{ id: "p", title: "Voice", endpoint: "https://proxy.example.com/v1", apiKeySet: true, apiKeyHint: "sk-a...wxyz" }],
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
