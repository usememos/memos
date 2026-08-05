import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, useNavigate } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { AppSidebarProvider, useAppSidebar } from "@/contexts/AppSidebarContext";

const Harness = () => {
  const navigate = useNavigate();
  const { attachmentSection, setAttachmentSection, inboxFilter, setInboxFilter } = useAppSidebar();
  return (
    <div>
      <output data-testid="attachment-section">{attachmentSection}</output>
      <output data-testid="inbox-filter">{inboxFilter}</output>
      <button type="button" onClick={() => setAttachmentSection("media")}>
        Select media
      </button>
      <button type="button" onClick={() => setInboxFilter("unread")}>
        Select unread
      </button>
      <button type="button" onClick={() => navigate("/inbox")}>
        Change route
      </button>
    </div>
  );
};

describe("AppSidebarProvider", () => {
  it("keeps page controls local and resets them after a route change", () => {
    render(
      <MemoryRouter initialEntries={["/attachments"]}>
        <AppSidebarProvider>
          <Harness />
        </AppSidebarProvider>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Select media" }));
    fireEvent.click(screen.getByRole("button", { name: "Select unread" }));
    expect(screen.getByTestId("attachment-section")).toHaveTextContent("media");
    expect(screen.getByTestId("inbox-filter")).toHaveTextContent("unread");

    fireEvent.click(screen.getByRole("button", { name: "Change route" }));
    expect(screen.getByTestId("attachment-section")).toHaveTextContent("all");
    expect(screen.getByTestId("inbox-filter")).toHaveTextContent("all");
  });
});
