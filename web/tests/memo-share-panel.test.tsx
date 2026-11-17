import { create } from "@bufbuild/protobuf";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Tooltip } from "@usememos/ui";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import MemoSharePanel from "@/components/MemoDetailSidebar/MemoSharePanel";
import { MemoShareSchema } from "@/types/proto/api/memo_service_pb";

const copyToClipboard = vi.hoisted(() => vi.fn());
const clients = vi.hoisted(() => ({
  createMemoShare: vi.fn(),
  deleteMemoShare: vi.fn(),
  listMemoShares: vi.fn(),
}));

vi.mock("copy-to-clipboard", () => ({ default: copyToClipboard }));
vi.mock("@/connect", () => ({ memoServiceClient: clients }));
vi.mock("@/lib/toast", () => ({ toast: { add: vi.fn(), close: vi.fn() }, showErrorToast: vi.fn() }));
vi.mock("@/utils/i18n", () => ({
  useTranslate: () => (key: string) => key,
}));

const renderPanel = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <Tooltip.Provider>
        <MemoSharePanel open onClose={vi.fn()} memoName="memos/detail" />
      </Tooltip.Provider>
    </QueryClientProvider>,
  );
};

describe("MemoSharePanel", () => {
  beforeAll(() => {
    Element.prototype.scrollIntoView = vi.fn();
    Element.prototype.hasPointerCapture = vi.fn(() => false);
    Element.prototype.setPointerCapture = vi.fn();
    Element.prototype.releasePointerCapture = vi.fn();
  });

  beforeEach(() => {
    copyToClipboard.mockReset();
    for (const client of Object.values(clients)) {
      client.mockReset();
    }
  });

  it("copies the share link when the Clipboard API is unavailable over plain HTTP", async () => {
    // navigator.clipboard exists only in secure contexts; jsdom has none, matching
    // the self-hosted http:// case where the copy button silently did nothing.
    copyToClipboard.mockResolvedValue(true);
    clients.listMemoShares.mockResolvedValue({
      memoShares: [create(MemoShareSchema, { name: "memos/detail/shares/share-token" })],
    });

    renderPanel();

    fireEvent.click(await screen.findByRole("button", { name: "memo.share.copy" }));

    expect(copyToClipboard).toHaveBeenCalledWith(`${window.location.origin}/memos/shares/share-token`);
    // The check mark proves setCopied ran — the copy path did not throw.
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "memo.share.copy" }).querySelector("svg.lucide-check")).not.toBeNull();
    });
  });

  it("does not show the check mark when the copy fails", async () => {
    copyToClipboard.mockResolvedValue(false);
    clients.listMemoShares.mockResolvedValue({
      memoShares: [create(MemoShareSchema, { name: "memos/detail/shares/share-token" })],
    });

    renderPanel();

    fireEvent.click(await screen.findByRole("button", { name: "memo.share.copy" }));

    await waitFor(() => expect(copyToClipboard).toHaveBeenCalled());
    // Flush the resolved copy promise so a wrongly-set check mark would appear.
    await act(async () => {});
    expect(screen.getByRole("button", { name: "memo.share.copy" }).querySelector("svg.lucide-check")).toBeNull();
  });
});
