import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import CreateWebhookDialog from "@/components/CreateWebhookDialog";

const clients = vi.hoisted(() => ({
  createUserWebhook: vi.fn(),
  getUserWebhookSigningSecret: vi.fn(),
  listUserWebhooks: vi.fn(),
  updateUserWebhook: vi.fn(),
}));

vi.mock("@/connect", () => ({
  userServiceClient: clients,
}));

vi.mock("@/hooks/useCurrentUser", () => ({
  default: () => ({ name: "users/alice" }),
}));

vi.mock("@/utils/i18n", () => ({
  useTranslate: () => (key: string) => key,
}));

describe("CreateWebhookDialog", () => {
  beforeAll(() => {
    Element.prototype.scrollIntoView = vi.fn();
    Element.prototype.hasPointerCapture = vi.fn(() => false);
    Element.prototype.setPointerCapture = vi.fn();
    Element.prototype.releasePointerCapture = vi.fn();
  });

  beforeEach(() => {
    for (const client of Object.values(clients)) {
      client.mockReset();
    }
  });

  it("reveals the server-generated secret after creating a webhook", async () => {
    clients.createUserWebhook.mockResolvedValue({ name: "users/alice/webhooks/deploy", signingSecretSet: true });
    clients.getUserWebhookSigningSecret.mockResolvedValue({ signingSecret: "whsec_created-secret" });
    const onOpenChange = vi.fn();
    const onSuccess = vi.fn();

    render(<CreateWebhookDialog open onOpenChange={onOpenChange} onSuccess={onSuccess} />);

    fireEvent.change(screen.getByLabelText(/setting\.webhook\.create-dialog\.title/), { target: { value: "Deploy" } });
    fireEvent.change(screen.getByLabelText(/setting\.webhook\.create-dialog\.payload-url/), {
      target: { value: "https://example.com/webhook" },
    });
    fireEvent.click(screen.getByRole("button", { name: "common.create" }));

    await waitFor(() =>
      expect(clients.createUserWebhook).toHaveBeenCalledWith({
        parent: "users/alice",
        webhook: { displayName: "Deploy", url: "https://example.com/webhook" },
      }),
    );
    expect(clients.getUserWebhookSigningSecret).toHaveBeenCalledWith({ name: "users/alice/webhooks/deploy" });
    expect(await screen.findByDisplayValue("whsec_created-secret")).toBeInTheDocument();
    expect(onSuccess).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "common.close" }));
    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("shows configured status and reveals an existing secret while editing", async () => {
    clients.listUserWebhooks.mockResolvedValue({
      webhooks: [
        {
          name: "users/alice/webhooks/deploy",
          displayName: "Deploy",
          url: "https://example.com/webhook",
          signingSecretSet: true,
        },
      ],
    });
    clients.getUserWebhookSigningSecret.mockResolvedValue({ signingSecret: "whsec_existing-secret" });

    render(<CreateWebhookDialog open webhookName="users/alice/webhooks/deploy" onOpenChange={vi.fn()} />);

    expect(await screen.findByText("setting.webhook.create-dialog.signing-secret-configured")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /setting\.webhook\.create-dialog\.reveal-secret/ }));

    expect(await screen.findByDisplayValue("whsec_existing-secret")).toBeInTheDocument();
    expect(clients.getUserWebhookSigningSecret).toHaveBeenCalledWith({ name: "users/alice/webhooks/deploy" });
  });
});
