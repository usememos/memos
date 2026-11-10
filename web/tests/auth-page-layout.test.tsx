import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AuthPageLayout from "@/components/AuthPageLayout";
import { InstanceAccessMode } from "@/types/proto/api/instance_service_pb";

const instance = vi.hoisted(() => ({ instanceUrl: "https://notes.example.com", accessMode: 1 }));
const settings = vi.hoisted(() => ({ customProfile: undefined as { title?: string; logoUrl?: string } | undefined }));

vi.mock("@/contexts/InstanceContext", () => ({
  useInstance: () => ({ profile: instance, generalSetting: settings }),
}));

vi.mock("@/utils/i18n", () => ({
  useTranslate: () => (key: string) => key,
  loadLocale: vi.fn(),
}));

vi.mock("@/components/AuthFooter", () => ({ default: () => <div data-testid="auth-footer" /> }));

const renderLayout = () =>
  render(
    <MemoryRouter>
      <AuthPageLayout title="Sign in">
        <div />
      </AuthPageLayout>
    </MemoryRouter>,
  );

describe("<AuthPageLayout>", () => {
  beforeEach(() => {
    instance.accessMode = InstanceAccessMode.PRIVATE;
    settings.customProfile = undefined;
  });

  it("offers no way out to Explore, even on public instances", () => {
    instance.accessMode = InstanceAccessMode.PUBLIC;
    renderLayout();

    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("keeps the language and theme row inside the card", () => {
    renderLayout();

    expect(screen.getByRole("main")).toContainElement(screen.getByTestId("auth-footer"));
  });

  it.each([undefined, "/logo.webp"])("uses a themeable small logo for the default %s", (logoUrl) => {
    settings.customProfile = { logoUrl };
    const { container } = renderLayout();

    expect(container.querySelector(".memos-mark")).toHaveAttribute("height", "32");
    expect(screen.getByText("Memos")).toBeInTheDocument();
    expect(container.querySelector("img")).toBeNull();
  });

  it("preserves custom logos and titles", () => {
    settings.customProfile = { title: "Team Notes", logoUrl: "/custom-logo.svg" };
    const { container } = renderLayout();

    expect(container.querySelector("img")).toHaveAttribute("src", "/custom-logo.svg");
    expect(container.querySelector(".memos-mark")).toBeNull();
    expect(screen.getByText("Team Notes")).toBeInTheDocument();
  });
});
