import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { MemoFilterProvider, parseFilterQuery, useMemoFilterContext } from "@/contexts/MemoFilterContext";
import { BUILTIN_TASKS_VIEW_ID } from "@/lib/memo-views";

const Harness = () => {
  const { filters, setFilters, setShortcut, shortcut } = useMemoFilterContext();
  return (
    <div>
      <output data-testid="filters">{JSON.stringify(filters)}</output>
      <output data-testid="shortcut">{shortcut}</output>
      <button type="button" onClick={() => setFilters([{ factor: "contentSearch", value: "plan" }])}>
        Search plan
      </button>
      <button type="button" onClick={() => setShortcut(BUILTIN_TASKS_VIEW_ID)}>
        Select Tasks
      </button>
    </div>
  );
};

describe("MemoFilterProvider", () => {
  it("keeps encoded values containing colons intact", () => {
    expect(parseFilterQuery("contentSearch:https://example.com:8080/path")).toEqual([
      { factor: "contentSearch", value: "https://example.com:8080/path" },
    ]);
  });

  it("keeps search filters when selecting a view", () => {
    render(
      <MemoryRouter>
        <MemoFilterProvider>
          <Harness />
        </MemoFilterProvider>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Search plan" }));
    fireEvent.click(screen.getByRole("button", { name: "Select Tasks" }));

    expect(screen.getByTestId("filters")).toHaveTextContent('[{"factor":"contentSearch","value":"plan"}]');
    expect(screen.getByTestId("shortcut")).toHaveTextContent(BUILTIN_TASKS_VIEW_ID);
  });
});
