import { create } from "@bufbuild/protobuf";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { PropsWithChildren } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import UsageLimitDialog from "@/components/Settings/UsageLimitDialog";
import UsageLimitsSection from "@/components/Settings/UsageLimitsSection";
import UsageSection from "@/components/Settings/UsageSection";
import { UsageLimit_Metric, UsageLimitSchema } from "@/types/proto/api/instance_service_pb";
import { UserSchema, UserUsage_EffectiveLimitSchema, UserUsageSchema } from "@/types/proto/api/user_service_pb";
import english from "../src/locales/en.json";

const MIB = 1024n * 1024n;

const mocks = vi.hoisted(() => ({
  getUserUsage: vi.fn(),
  listUsers: vi.fn(),
  listUsageLimits: vi.fn(),
  createUsageLimit: vi.fn(),
  updateUsageLimit: vi.fn(),
  deleteUsageLimit: vi.fn(),
}));

vi.mock("@/connect", () => ({
  userServiceClient: { getUserUsage: mocks.getUserUsage, listUsers: mocks.listUsers },
  instanceServiceClient: {
    listUsageLimits: mocks.listUsageLimits,
    createUsageLimit: mocks.createUsageLimit,
    updateUsageLimit: mocks.updateUsageLimit,
    deleteUsageLimit: mocks.deleteUsageLimit,
  },
}));
vi.mock("@/hooks/useCurrentUser", () => ({ default: () => ({ name: "users/alice" }) }));
vi.mock("react-hot-toast", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
// Render the English copy, so the assertions read like the screen.
vi.mock("@/utils/i18n", () => ({
  useTranslate: () => (key: string, params?: Record<string, unknown>) => {
    const text = key.split(".").reduce<unknown>((node, part) => (node as Record<string, unknown>)?.[part], english);
    return typeof text === "string" ? text.replace(/\{\{(\w+)\}\}/g, (_, name) => String(params?.[name])) : key;
  },
}));

const wrapper = ({ children }: PropsWithChildren) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>
    {children}
  </QueryClientProvider>
);

const limit = (id: string, metric: UsageLimit_Metric, value: bigint, user = "") =>
  create(UsageLimitSchema, { name: `usageLimits/${id}`, metric, value, user });

const alice = create(UserSchema, { name: "users/alice", username: "alice", displayName: "Alice" });
const bob = create(UserSchema, { name: "users/bob", username: "bob" });
const carol = create(UserSchema, { name: "users/carol", username: "carol" });

const effective = (value: bigint, usageLimit = "") => create(UserUsage_EffectiveLimitSchema, { value, usageLimit });

beforeEach(() => {
  for (const mock of Object.values(mocks)) mock.mockReset();
  mocks.createUsageLimit.mockResolvedValue({});
  mocks.updateUsageLimit.mockResolvedValue({});
  mocks.deleteUsageLimit.mockResolvedValue({});
  mocks.listUsers.mockResolvedValue({ users: [alice, bob, carol], nextPageToken: "" });
});

describe("UsageSection", () => {
  it("is hidden when no limit applies", async () => {
    mocks.getUserUsage.mockResolvedValue(
      create(UserUsageSchema, {
        memoCount: 5n,
        memoCountLimit: effective(0n),
        storageBytesLimit: effective(0n),
        uploadBytesLimit: effective(0n),
      }),
    );
    const { container } = render(<UsageSection />, { wrapper });
    await waitFor(() => expect(mocks.getUserUsage).toHaveBeenCalledWith({ name: "users/alice/usage" }));
    expect(container).toBeEmptyDOMElement();
  });

  it("shows usage against the limits in effect", async () => {
    mocks.getUserUsage.mockResolvedValue(
      create(UserUsageSchema, {
        memoCount: 12n,
        storageBytes: 512n * MIB,
        memoCountLimit: effective(1000n, "usageLimits/default-memos"),
        storageBytesLimit: effective(1024n * MIB, "usageLimits/alice-storage"),
        uploadBytesLimit: effective(0n),
      }),
    );
    render(<UsageSection />, { wrapper });
    expect(await screen.findByText("Usage limits")).toBeInTheDocument();
    expect(screen.getByText("12 of 1,000")).toBeInTheDocument();
    expect(screen.getByText("512.0 MB of 1.0 GB")).toBeInTheDocument();
    expect(screen.queryByText("Largest file")).not.toBeInTheDocument();
  });
});

// Closed select popups can stay mounted, so pick the option from the list the trigger controls.
const chooseOption = async (select: string, option: string) => {
  const trigger = screen.getByRole("combobox", { name: select });
  fireEvent.click(trigger);
  const list = await waitFor(() => {
    const element = document.getElementById(trigger.getAttribute("aria-controls") ?? "");
    expect(element).not.toBeNull();
    return element as HTMLElement;
  });
  const item = within(list).getByRole("option", { name: option });
  fireEvent.pointerDown(item, { pointerType: "mouse" });
  fireEvent.click(item, { pointerType: "mouse" });
};

const openRowMenu = async (name: string, item: string) => {
  fireEvent.click(await screen.findByRole("button", { name: `Actions for ${name}` }));
  fireEvent.click(await screen.findByRole("menuitem", { name: item }));
};

describe("UsageLimitsSection", () => {
  it("shows one table: all users first, then users with their own limits", async () => {
    mocks.listUsageLimits.mockResolvedValue({
      usageLimits: [
        limit("default-memos", UsageLimit_Metric.MEMO_COUNT, 100n),
        limit("default-content", UsageLimit_Metric.MEMO_CONTENT_BYTES, 8192n),
        limit("bob-memos", UsageLimit_Metric.MEMO_COUNT, 0n, "users/bob"),
        limit("bob-storage", UsageLimit_Metric.STORAGE_BYTES, 5n * 1024n * MIB, "users/bob"),
      ],
      nextPageToken: "",
    });
    render(<UsageLimitsSection />, { wrapper });

    const bobCell = await screen.findByText("@bob");
    const rows = screen.getAllByRole("row").slice(1);
    const text = (row: HTMLElement) =>
      within(row)
        .getAllByRole("cell")
        .map((cell) => cell.textContent);
    expect(rows).toHaveLength(2);
    expect(text(rows[0])).toEqual(["All usersEveryone, admins included", "100", "8.0 KB", "Unlimited", "Unlimited", ""]);
    expect(text(rows[1])).toEqual(["bob@bob", "Unlimited", "8.0 KB", "5.0 GB", "Unlimited", ""]);
    expect(bobCell.closest("tr")).toBe(rows[1]);
    // Users without their own limits get no row.
    expect(screen.queryByText("Alice")).not.toBeInTheDocument();
  });

  it("removes all of a user's own limits", async () => {
    mocks.listUsageLimits.mockResolvedValue({
      usageLimits: [
        limit("bob-memos", UsageLimit_Metric.MEMO_COUNT, 0n, "users/bob"),
        limit("bob-storage", UsageLimit_Metric.STORAGE_BYTES, 5n * 1024n * MIB, "users/bob"),
      ],
      nextPageToken: "",
    });
    render(<UsageLimitsSection />, { wrapper });
    await screen.findByText("@bob");

    await openRowMenu("bob", "Remove");
    expect(await screen.findByText("Remove the limits for bob?")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Remove" }));

    await waitFor(() => expect(mocks.deleteUsageLimit).toHaveBeenCalledTimes(2));
    expect(mocks.deleteUsageLimit).toHaveBeenCalledWith({ name: "usageLimits/bob-memos" });
    expect(mocks.deleteUsageLimit).toHaveBeenCalledWith({ name: "usageLimits/bob-storage" });
  });
});

describe("UsageLimitDialog", () => {
  it("creates, updates and removes the limits for all users", async () => {
    mocks.listUsageLimits.mockResolvedValue({
      usageLimits: [
        limit("default-memos", UsageLimit_Metric.MEMO_COUNT, 100n),
        limit("default-content", UsageLimit_Metric.MEMO_CONTENT_BYTES, 8192n),
        limit("default-storage", UsageLimit_Metric.STORAGE_BYTES, 1024n * MIB),
      ],
      nextPageToken: "",
    });
    render(<UsageLimitDialog open onOpenChange={vi.fn()} target={{ kind: "all" }} candidates={[]} />, { wrapper });

    expect(await screen.findByText("Limits for all users")).toBeInTheDocument();
    const memos = screen.getByRole("textbox", { name: "Memos" });
    await waitFor(() => expect(memos).toHaveValue("100"));
    expect(screen.getByRole("textbox", { name: "Storage (MiB)" })).toHaveValue("1024");
    const content = screen.getByRole("textbox", { name: "Memo content (KiB)" });
    expect(content).toHaveValue("8");
    fireEvent.change(content, { target: { value: "4" } });
    expect(screen.getByRole("textbox", { name: "Largest file (MiB)" })).toHaveAttribute("placeholder", "Unlimited");

    fireEvent.change(memos, { target: { value: "200" } });
    fireEvent.change(screen.getByRole("textbox", { name: "Storage (MiB)" }), { target: { value: "" } });
    fireEvent.change(screen.getByRole("textbox", { name: "Largest file (MiB)" }), { target: { value: "10" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(mocks.createUsageLimit).toHaveBeenCalled());
    expect(mocks.updateUsageLimit).toHaveBeenCalledWith(
      expect.objectContaining({ usageLimit: expect.objectContaining({ name: "usageLimits/default-memos", value: 200n }) }),
    );
    expect(mocks.deleteUsageLimit).toHaveBeenCalledWith({ name: "usageLimits/default-storage" });
    expect(mocks.updateUsageLimit).toHaveBeenCalledWith(
      expect.objectContaining({ usageLimit: expect.objectContaining({ name: "usageLimits/default-content", value: 4096n }) }),
    );
    expect(mocks.createUsageLimit).toHaveBeenCalledWith({
      usageLimit: expect.objectContaining({ metric: UsageLimit_Metric.UPLOAD_BYTES, user: "", value: 10n * MIB }),
    });
  });

  it("edits a user's own limits, with the all-users limits as placeholders", async () => {
    mocks.listUsageLimits.mockResolvedValue({
      usageLimits: [
        limit("default-memos", UsageLimit_Metric.MEMO_COUNT, 100n),
        limit("bob-storage", UsageLimit_Metric.STORAGE_BYTES, 5n * 1024n * MIB, "users/bob"),
        limit("bob-file-size", UsageLimit_Metric.UPLOAD_BYTES, 0n, "users/bob"),
      ],
      nextPageToken: "",
    });
    render(<UsageLimitDialog open onOpenChange={vi.fn()} target={{ kind: "user", user: bob }} candidates={[]} />, {
      wrapper,
    });

    expect(await screen.findByText("Limits for bob")).toBeInTheDocument();
    const memos = screen.getByRole("textbox", { name: "Memos" });
    const storage = screen.getByRole("textbox", { name: "Storage (MiB)" });
    await waitFor(() => expect(storage).toHaveValue("5120"));
    expect(memos).toHaveValue("");
    expect(memos).toHaveAttribute("placeholder", "All users: 100");
    // No limit for bob shows as 0, because empty means the all-users limit.
    expect(screen.getByRole("textbox", { name: "Largest file (MiB)" })).toHaveValue("0");

    fireEvent.change(storage, { target: { value: "" } });
    fireEvent.change(memos, { target: { value: "50" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(mocks.deleteUsageLimit).toHaveBeenCalledWith({ name: "usageLimits/bob-storage" }));
    expect(mocks.createUsageLimit).toHaveBeenCalledWith({
      usageLimit: expect.objectContaining({ metric: UsageLimit_Metric.MEMO_COUNT, user: "users/bob", value: 50n }),
    });
    expect(mocks.updateUsageLimit).not.toHaveBeenCalled();
  });

  it("adds limits for a picked user", async () => {
    mocks.listUsageLimits.mockResolvedValue({ usageLimits: [], nextPageToken: "" });
    render(<UsageLimitDialog open onOpenChange={vi.fn()} target={{ kind: "add" }} candidates={[carol]} />, { wrapper });

    expect(await screen.findByRole("heading", { name: "Add user limit" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();

    await chooseOption("User", "@carol");
    const fileSize = screen.getByRole("textbox", { name: "Largest file (MiB)" });
    await waitFor(() => expect(fileSize).toBeEnabled());
    fireEvent.change(fileSize, { target: { value: "10" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(mocks.createUsageLimit).toHaveBeenCalledWith({
        usageLimit: expect.objectContaining({ metric: UsageLimit_Metric.UPLOAD_BYTES, user: "users/carol", value: 10n * MIB }),
      }),
    );
    expect(mocks.createUsageLimit).toHaveBeenCalledTimes(1);
  });
});
