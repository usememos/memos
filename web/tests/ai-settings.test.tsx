import { create } from "@bufbuild/protobuf";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import AISection from "@/components/Settings/AISection";
import { type InstanceSetting, InstanceSetting_AISettingSchema } from "@/types/proto/api/instance_service_pb";

const updateSetting = vi.fn<(setting: InstanceSetting) => Promise<void>>();
const fetchSetting = vi.fn<() => Promise<void>>();
let aiSetting = create(InstanceSetting_AISettingSchema);

vi.mock("@/contexts/InstanceContext", () => ({ useInstance: () => ({ aiSetting, updateSetting, fetchSetting }) }));
vi.mock("@/hooks/useConfigurationQueries", () => ({ useManagedResource: () => undefined, isFieldManaged: () => false }));

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

  fireEvent.click(screen.getByRole("combobox", { name: "Provider" }));
  const option = await screen.findByRole("option", { name: "Voice" });
  fireEvent.pointerDown(option, { pointerType: "mouse" });
  fireEvent.click(option);
  expect(screen.queryByText(/selected provider has no API key/i)).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  expect(updateSetting.mock.lastCall?.[0].value.value).toMatchObject({
    providers: [{ id: provider.id, apiKey: "" }],
    transcription: { providerId: provider.id },
  });
});
