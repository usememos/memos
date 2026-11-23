import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import TagsSection from "@/components/Settings/TagsSection";

const { getUserStats } = vi.hoisted(() => ({ getUserStats: vi.fn() }));
vi.mock("@/connect", () => ({ userServiceClient: { getUserStats } }));
vi.mock("@/utils/i18n", () => ({
  useTranslate: () => (key: string, options?: { count: number }) =>
    options ? `${options.count} ${options.count === 1 ? "memo" : "memos"}` : key,
}));
const settings = { tags: Object.fromEntries(["a/.*", "a+", ".+"].map((rule) => [rule, { blurContent: false }])) };
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ currentUser: { name: "users/test" }, userTagsSetting: settings }),
}));

it("shows distinct totals from filtered stats and omits oversized rules without a request", async () => {
  // Comments are left out of lists by default, so the counts leave them out too.
  const totals = new Map([
    ['(tags.exists(t, t.startsWith("a/"))) && (parent == null)', 1],
    ['(tag in ["a","a+","aaa"]) && (parent == null)', 3],
  ]);
  getUserStats.mockImplementation(async ({ name, filter }) => {
    expect(name).toBe("users/test");
    if (filter === "parent == null") return { tagCounts: { a: 1, "a/x": 1, "a/y": 1, "a+": 1, aaa: 2, ["z".repeat(8192)]: 1 } };
    expect(totals.has(filter)).toBe(true);
    return { totalMemoCount: totals.get(filter) };
  });

  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <TagsSection />
    </QueryClientProvider>,
  );

  const row = (name: string) => within(screen.getByText(name, { selector: "span" }).closest("li")!);
  expect(await row("a/.*").findByText("1 memo")).toBeVisible();
  expect(await row("a+").findByText("3 memos")).toBeVisible();
  expect(row(".+").queryByText(/memos?$/)).toBeNull();
  expect(getUserStats).toHaveBeenCalledTimes(3);
});
