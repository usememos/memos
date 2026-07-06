import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LocaleSearchList } from "@/components/LocalePicker";

describe("<LocaleSearchList>", () => {
  it("links to GitHub feedback when no locale matches the search", async () => {
    render(<LocaleSearchList value="en" onChange={() => {}} />);

    fireEvent.change(await screen.findByRole("textbox", { name: "Language" }), { target: { value: "klingon" } });

    const feedbackLink = screen.getByRole("link", { name: "Language not found? Submit feedback" });
    expect(feedbackLink).toHaveAttribute("href", expect.stringContaining("https://github.com/usememos/memos/issues/new"));
  });
});
