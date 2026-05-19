import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import PagedMemoList from "@/components/PagedMemoList";

vi.mock("@/hooks/useMemoQueries", () => ({
  useInfiniteMemos: () => ({
    data: { pages: [{ memos: [], nextPageToken: "" }] },
    fetchNextPage: vi.fn(async () => undefined),
    hasNextPage: false,
    isFetchingNextPage: false,
    isLoading: false,
  }),
}));

vi.mock("@/contexts/MemoFilterContext", () => ({
  useMemoFilterContext: () => ({ filters: [] }),
}));

vi.mock("@/utils/i18n", () => ({
  useTranslate: () => (key: string) => (key === "message.no-data" ? "No data found." : key),
}));

vi.mock("@/components/MemoContent/MentionResolutionContext", () => ({
  MentionResolutionProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@/components/MemoFilters", () => ({
  default: () => <div data-testid="memo-filters" />,
}));

vi.mock("@/components/MemoEditor", () => ({
  default: () => <div data-testid="memo-editor" />,
}));

describe("<PagedMemoList>", () => {
  it("uses the tile sprite Placeholder for the empty state", () => {
    const queryClient = new QueryClient();

    render(
      <QueryClientProvider client={queryClient}>
        <PagedMemoList renderer={() => <div />} />
      </QueryClientProvider>,
    );

    expect(screen.getByText("No data found.")).toBeInTheDocument();
    expect(screen.getByTestId("placeholder-sprite")).toBeInTheDocument();
  });
});
