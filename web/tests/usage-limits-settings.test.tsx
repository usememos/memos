import { create } from "@bufbuild/protobuf";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { PropsWithChildren } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import UsageLimitDialog from "@/components/Settings/UsageLimitDialog";
import UsageLimitsSection from "@/components/Settings/UsageLimitsSection";
import UsageSection from "@/components/Settings/UsageSection";
import { newUsageLimitEntry } from "@/components/Settings/usageLimitValues";
import type { UsageLimitEntry } from "@/hooks/useUsageLimitQueries";
import { InstanceSettingSchema } from "@/types/proto/api/instance_service_pb";
import { UserSchema, UserUsageSchema } from "@/types/proto/api/user_service_pb";
import english from "../src/locales/en.json";

const MIB = 1024n * 1024n;

const mocks = vi.hoisted(() => ({
  getUserUsage: vi.fn(),
  listUsers: vi.fn(),
  getInstanceSetting: vi.fn(),
  updateInstanceSetting: vi.fn(),
}));

vi.mock("@/connect", () => ({
  userServiceClient: { getUserUsage: mocks.getUserUsage, listUsers: mocks.listUsers },
  instanceServiceClient: { getInstanceSetting: mocks.getInstanceSetting, updateInstanceSetting: mocks.updateInstanceSetting },
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

const settingOf = (limits: UsageLimitEntry[]) =>
  create(InstanceSettingSchema, { name: "instance/settings/USAGE_LIMITS", value: { case: "usageLimitsSetting", value: { limits } } });

const alice = create(UserSchema, { name: "users/alice", username: "alice", displayName: "Alice" });
const bob = create(UserSchema, { name: "users/bob", username: "bob" });
const carol = create(UserSchema, { name: "users/carol", username: "carol" });

const defaults = newUsageLimitEntry({ allUsers: true, memoCount: 100n, memoContentBytes: 8192n, storageBytes: 1024n * MIB });

beforeEach(() => {
  for (const mock of Object.values(mocks)) mock.mockReset();
  mocks.listUsers.mockResolvedValue({ users: [alice, bob, carol], nextPageToken: "" });
  mocks.updateInstanceSetting.mockImplementation(async ({ instanceSetting }) => instanceSetting);
});

describe("UsageSection", () => {
  it("is hidden when no limit applies", async () => {
    mocks.getUserUsage.mockResolvedValue(create(UserUsageSchema, { memoCount: 5n, limits: { memoCount: 0n } }));
    const { container } = render(<UsageSection />, { wrapper });
    await waitFor(() => expect(mocks.getUserUsage).toHaveBeenCalledWith({ name: "users/alice/usage" }));
    expect(container).toBeEmptyDOMElement();
  });

  it("shows usage against the limit set in effect", async () => {
    mocks.getUserUsage.mockResolvedValue(
      create(UserUsageSchema, {
        memoCount: 12n,
        storageBytes: 512n * MIB,
        limits: { memoCount: 1000n, storageBytes: 1024n * MIB },
        limitIndex: 1,
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
  fireEvent.click(await screen.findByRole("button", { name: `Actions for entry ${name}` }));
  fireEvent.click(await screen.findByRole("menuitem", { name: item }));
};

const savedLimits = () =>
  (mocks.updateInstanceSetting.mock.calls[0][0].instanceSetting.value.value as { limits: UsageLimitEntry[] }).limits;

describe("UsageLimitsSection", () => {
  it("shows the entries in the order they are checked, the default last", async () => {
    mocks.getInstanceSetting.mockResolvedValue(
      settingOf([
        newUsageLimitEntry({ users: ["users/bob"], storageBytes: 5n * 1024n * MIB }),
        newUsageLimitEntry({ users: ["users/bob", "users/carol"], memoCount: 0n, memoContentBytes: 8192n }),
        defaults,
      ]),
    );
    render(<UsageLimitsSection />, { wrapper });

    expect(await screen.findByText(/checked from top to bottom/)).toBeInTheDocument();
    await screen.findByText("carol");
    const rows = screen.getAllByRole("row").slice(1);
    const text = (row: HTMLElement) =>
      within(row)
        .getAllByRole("cell")
        .map((cell) => cell.textContent);
    expect(rows).toHaveLength(3);
    expect(text(rows[0])).toEqual(["1", "bob", "Unlimited", "Unlimited", "5.0 GB", "Unlimited", ""]);
    expect(text(rows[1])).toEqual(["2", "bobcarol", "Unlimited", "8.0 KB", "Unlimited", "Unlimited", ""]);
    expect(text(rows[2])).toEqual([
      "3",
      "All usersEveryone not named above. This is the default.",
      "100",
      "8.0 KB",
      "1.0 GB",
      "Unlimited",
      "",
    ]);
    expect(screen.queryByText("Never applies")).not.toBeInTheDocument();
  });

  it("flags an entry that an earlier entry shadows completely", async () => {
    mocks.getInstanceSetting.mockResolvedValue(
      settingOf([
        newUsageLimitEntry({ users: ["users/bob", "users/carol"], memoCount: 10n }),
        newUsageLimitEntry({ users: ["users/bob"], memoCount: 20n }),
        defaults,
      ]),
    );
    render(<UsageLimitsSection />, { wrapper });
    const badge = await screen.findByText("Never applies");
    expect(badge.closest("tr")).toBe(screen.getAllByRole("row")[2]);
  });

  it("moves an entry up and saves the whole list", async () => {
    const first = newUsageLimitEntry({ users: ["users/bob"], memoCount: 10n });
    const second = newUsageLimitEntry({ users: ["users/carol"], memoCount: 20n });
    mocks.getInstanceSetting.mockResolvedValue(settingOf([first, second, defaults]));
    render(<UsageLimitsSection />, { wrapper });
    await screen.findByText("carol");

    await openRowMenu("2", "Move up");
    await waitFor(() => expect(mocks.updateInstanceSetting).toHaveBeenCalledTimes(1));
    expect(savedLimits().map((entry) => entry.users)).toEqual([["users/carol"], ["users/bob"], []]);
  });

  it("does not let the default move or be removed", async () => {
    mocks.getInstanceSetting.mockResolvedValue(settingOf([newUsageLimitEntry({ users: ["users/bob"] }), defaults]));
    render(<UsageLimitsSection />, { wrapper });
    await screen.findByText("bob");

    fireEvent.click(await screen.findByRole("button", { name: "Actions for entry All users" }));
    expect(await screen.findByRole("menuitem", { name: "Edit" })).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "Remove" })).not.toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "Move up" })).not.toBeInTheDocument();
  });

  it("removes an entry after confirmation", async () => {
    mocks.getInstanceSetting.mockResolvedValue(settingOf([newUsageLimitEntry({ users: ["users/bob"], memoCount: 10n }), defaults]));
    render(<UsageLimitsSection />, { wrapper });
    await screen.findByText("bob");

    await openRowMenu("1", "Remove");
    expect(await screen.findByText("Remove this entry?")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Remove" }));

    await waitFor(() => expect(mocks.updateInstanceSetting).toHaveBeenCalledTimes(1));
    expect(savedLimits()).toHaveLength(1);
    expect(savedLimits()[0].allUsers).toBe(true);
  });
});

describe("UsageLimitDialog", () => {
  it("edits the limits for all users", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(
      <UsageLimitDialog
        open
        onOpenChange={vi.fn()}
        entry={defaults}
        defaults={defaults}
        users={[alice, bob]}
        saving={false}
        onSave={onSave}
      />,
      {
        wrapper,
      },
    );

    expect(await screen.findByText("Limits for all users")).toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    const memos = screen.getByRole("textbox", { name: "Memos" });
    expect(memos).toHaveValue("100");
    expect(screen.getByRole("textbox", { name: "Storage (MiB)" })).toHaveValue("1024");
    const content = screen.getByRole("textbox", { name: "Memo content (KiB)" });
    expect(content).toHaveValue("8");
    expect(screen.getByRole("textbox", { name: "Largest file (MiB)" })).toHaveAttribute("placeholder", "Unlimited");

    fireEvent.change(memos, { target: { value: "200" } });
    fireEvent.change(content, { target: { value: "4" } });
    fireEvent.change(screen.getByRole("textbox", { name: "Storage (MiB)" }), { target: { value: "" } });
    fireEvent.change(screen.getByRole("textbox", { name: "Largest file (MiB)" }), { target: { value: "10" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    const saved = onSave.mock.calls[0][0] as UsageLimitEntry;
    expect(saved.allUsers).toBe(true);
    expect(saved.users).toEqual([]);
    expect(saved.memoCount).toBe(200n);
    expect(saved.memoContentBytes).toBe(4096n);
    expect(saved.storageBytes).toBeUndefined();
    expect(saved.uploadBytes).toBe(10n * MIB);
  });

  it("adds an entry for picked users, starting from the default values", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(
      <UsageLimitDialog open onOpenChange={vi.fn()} defaults={defaults} users={[alice, bob, carol]} saving={false} onSave={onSave} />,
      {
        wrapper,
      },
    );

    expect(await screen.findByRole("heading", { name: "Add entry" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Memos" })).toHaveValue("100");
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();

    await chooseOption("Users", "@carol");
    await waitFor(() => expect(screen.getByRole("button", { name: "Save" })).toBeEnabled());
    fireEvent.change(screen.getByRole("textbox", { name: "Largest file (MiB)" }), { target: { value: "10" } });
    fireEvent.change(screen.getByRole("textbox", { name: "Memos" }), { target: { value: "0" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    const saved = onSave.mock.calls[0][0] as UsageLimitEntry;
    expect(saved.allUsers).toBe(false);
    expect(saved.users).toEqual(["users/carol"]);
    expect(saved.uploadBytes).toBe(10n * MIB);
    expect(saved.memoCount).toBeUndefined();
    expect(saved.memoContentBytes).toBe(8192n);
  });

  it("keeps the stored value of a field the admin did not touch", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    // 8,193 bytes displays as 8 KiB; re-parsing the text would turn it into 8,192.
    const entry = newUsageLimitEntry({ users: ["users/bob"], memoContentBytes: 8193n, storageBytes: 1n });
    render(
      <UsageLimitDialog open onOpenChange={vi.fn()} entry={entry} defaults={defaults} users={[bob]} saving={false} onSave={onSave} />,
      {
        wrapper,
      },
    );
    expect(await screen.findByRole("textbox", { name: "Memo content (KiB)" })).toHaveValue("8");
    expect(screen.getByRole("textbox", { name: "Storage (MiB)" })).not.toHaveValue("0");
    fireEvent.change(screen.getByRole("textbox", { name: "Memos" }), { target: { value: "5" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    const saved = onSave.mock.calls[0][0] as UsageLimitEntry;
    expect(saved.memoContentBytes).toBe(8193n);
    expect(saved.storageBytes).toBe(1n);
    expect(saved.memoCount).toBe(5n);
  });

  it("rejects a byte size that does not fit an integer instead of throwing", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(
      <UsageLimitDialog open onOpenChange={vi.fn()} entry={defaults} defaults={defaults} users={[]} saving={false} onSave={onSave} />,
      {
        wrapper,
      },
    );
    const storage = await screen.findByRole("textbox", { name: "Storage (MiB)" });
    fireEvent.change(storage, { target: { value: "9".repeat(400) } });
    expect(storage).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  });

  it("removes a user from the entry", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const entry = newUsageLimitEntry({ users: ["users/bob", "users/carol"], memoCount: 10n });
    render(
      <UsageLimitDialog
        open
        onOpenChange={vi.fn()}
        entry={entry}
        defaults={defaults}
        users={[bob, carol]}
        saving={false}
        onSave={onSave}
      />,
      {
        wrapper,
      },
    );
    expect(await screen.findByRole("heading", { name: "Edit entry" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Remove bob" }));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect((onSave.mock.calls[0][0] as UsageLimitEntry).users).toEqual(["users/carol"]);
  });
});
