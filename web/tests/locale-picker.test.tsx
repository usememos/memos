import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import LocalePicker from "@/components/LocalePicker";

describe("<LocalePicker>", () => {
  it("links to GitHub feedback when no locale matches the search", async () => {
    render(<LocalePicker value="en" onChange={() => {}} />);

    const input = await screen.findByRole("combobox", { name: "Language" });
    fireEvent.click(screen.getByRole("button", { name: "Language" }));
    fireEvent.change(input, { target: { value: "klingon" } });

    const feedbackLink = await screen.findByRole("link", { name: "Language not found? Submit feedback" });
    expect(feedbackLink).toHaveAttribute("href", expect.stringContaining("https://github.com/usememos/memos/issues/new"));
  });

  it("finds a locale by name and picks it", async () => {
    const picked: string[] = [];
    render(<LocalePicker value="en" onChange={(locale) => picked.push(locale)} />);

    const input = await screen.findByRole("combobox", { name: "Language" });
    fireEvent.click(screen.getByRole("button", { name: "Language" }));
    fireEvent.change(input, { target: { value: "Deutsch" } });
    fireEvent.click(await screen.findByRole("option", { name: /Deutsch/ }));

    expect(picked).toEqual(["de"]);
  });
});
