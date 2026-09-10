import { create } from "@bufbuild/protobuf";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import MemoViewIcon from "@/components/MemoViewIcon";
import MemoViews from "@/pages/MemoViews";
import { MemoView_IconSchema, MemoViewSchema } from "@/types/proto/api/v1/user_service_pb";

const mocks = vi.hoisted(() => ({ create: vi.fn(), update: vi.fn() }));
vi.mock("@/connect", () => ({ userServiceClient: { createMemoView: mocks.create, updateMemoView: mocks.update } }));
vi.mock("@/hooks/useCurrentUser", () => ({ default: () => ({ name: "users/steven" }) }));
vi.mock("@/hooks/useUserQueries", () => ({ useMemoViews: () => ({ data: [] }), userKeys: { memoViews: () => ["views"] } }));
vi.mock("@/contexts/MemoFilterContext", () => ({ useMemoFilterContext: () => ({ setMemoView: vi.fn() }) }));
vi.mock("@/utils/i18n", () => ({ useTranslate: () => (key: string) => key }));

const emoji = create(MemoView_IconSchema, { value: { case: "emoji", value: "🌱" } });
const leaf = create(MemoView_IconSchema, { value: { case: "lucide", value: "leaf" } });
const existingView = create(MemoViewSchema, { name: "users/steven/views/garden", title: "Garden", filter: "pinned", icon: emoji });
const iconMask = expect.objectContaining({ paths: ["title", "filter", "icon"] });

function renderPage(edit = false) {
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={[{ pathname: "/views", state: edit ? { memoView: existingView } : { openCreate: true } }]}>
        <MemoViews />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.create.mockResolvedValue({});
  mocks.update.mockResolvedValue({});
});

describe("memo view icons", () => {
  it("renders emoji and symbols with a view-specific fallback", () => {
    const view = render(<MemoViewIcon />);
    expect(view.container.querySelector(".lucide-parentheses")).not.toBeNull();
    view.rerender(<MemoViewIcon icon={emoji} />);
    expect(view.container).toHaveTextContent("🌱");
    view.rerender(<MemoViewIcon icon={leaf} />);
    expect(view.container.querySelector(".lucide-leaf")).not.toBeNull();
    view.rerender(<MemoViewIcon icon={create(MemoView_IconSchema, { value: { case: "lucide", value: "future-icon" } })} />);
    expect(view.container.querySelector(".lucide-parentheses")).not.toBeNull();
  });

  it("creates and validates a view with a selected icon", async () => {
    renderPage();
    fireEvent.change(screen.getByLabelText("common.title"), { target: { value: "Garden" } });
    fireEvent.change(screen.getByLabelText("common.filter"), { target: { value: "pinned" } });
    fireEvent.click(screen.getByRole("button", { name: "setting.memo-view.change-icon" }));
    const search = await screen.findByRole("textbox", { name: "space.icon.search-icons" });
    fireEvent.change(search, { target: { value: "leaf" } });
    fireEvent.keyDown(search, { key: "Enter" });
    fireEvent.click(screen.getByRole("button", { name: "Validate" }));
    await waitFor(() =>
      expect(mocks.create).toHaveBeenCalledWith(
        expect.objectContaining({
          validateOnly: true,
          memoView: expect.objectContaining({ icon: leaf }),
        }),
      ),
    );
    await waitFor(() => expect(screen.getByRole("button", { name: "common.save" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "common.save" }));
    await waitFor(() =>
      expect(mocks.create).toHaveBeenLastCalledWith({
        parent: "users/steven",
        memoView: { name: "", title: "Garden", filter: "pinned", icon: leaf },
      }),
    );
  });

  it("preserves the icon when editing from the sidebar and applying an example", async () => {
    renderPage(true);
    expect(screen.getByRole("button", { name: "setting.memo-view.change-icon" })).toHaveTextContent("🌱");
    fireEvent.click(screen.getByRole("button", { name: /Recent notes/ }));
    fireEvent.click(screen.getByRole("button", { name: "common.save" }));
    await waitFor(() =>
      expect(mocks.update).toHaveBeenCalledWith(
        expect.objectContaining({
          memoView: expect.objectContaining({
            name: existingView.name,
            title: "Garden",
            icon: emoji,
            filter: 'created_ts >= now - duration("1h")',
          }),
          updateMask: iconMask,
        }),
      ),
    );
  });

  it("resets an existing icon using the icon update mask", async () => {
    renderPage(true);
    fireEvent.click(screen.getByRole("button", { name: "setting.memo-view.change-icon" }));
    fireEvent.click(await screen.findByRole("button", { name: "space.icon.reset" }));
    expect(screen.getByRole("button", { name: "setting.memo-view.change-icon" }).querySelector(".lucide-parentheses")).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "common.save" }));
    await waitFor(() =>
      expect(mocks.update).toHaveBeenCalledWith(
        expect.objectContaining({
          memoView: expect.objectContaining({ icon: undefined }),
          updateMask: iconMask,
        }),
      ),
    );
  });
});
