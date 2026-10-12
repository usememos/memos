import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { LegacyProfileRedirect } from "@/router/LegacyProfileRedirect";

const HomeLocation = () => {
  const location = useLocation();
  return <span data-testid="location">{`${location.pathname}${location.search}${location.hash}`}</span>;
};

describe("legacy profile links", () => {
  it.each([
    ["/u/alice", "/?creator=alice"],
    ["/u/j%C3%BAlia?filter=tagSearch%3Awork#memo", "/?filter=tagSearch%3Awork&creator=j%C3%BAlia#memo"],
    ["/u/alice?creator=bob", "/?creator=alice"],
  ])("redirects %s to %s", (source, expected) => {
    render(
      <MemoryRouter initialEntries={[source]}>
        <Routes>
          <Route path="/u/:username" element={<LegacyProfileRedirect />} />
          <Route path="/" element={<HomeLocation />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByTestId("location")).toHaveTextContent(expected);
  });
});
