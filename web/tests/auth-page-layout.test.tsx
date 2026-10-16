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

const renderLayout = (props?: { hideExplore?: boolean }) =>
  render(
    <MemoryRouter>
      <AuthPageLayout title="Sign in" {...props}>
        <div />
      </AuthPageLayout>
    </MemoryRouter>,
  );

describe("<AuthPageLayout> explore band", () => {
  beforeEach(() => {
    instance.accessMode = InstanceAccessMode.PRIVATE;
    settings.customProfile = undefined;
  });

  it("links to Explore on public instances", () => {
    instance.accessMode = InstanceAccessMode.PUBLIC;
    renderLayout();

    expect(screen.getByRole("link", { name: /auth\.explore-public-memos/ })).toHaveAttribute("href", "/explore");
  });

  it("omits the band on private instances even when an instance URL is configured", () => {
    renderLayout();

    expect(screen.queryByRole("link", { name: /auth\.explore-public-memos/ })).not.toBeInTheDocument();
  });

  it("omits the band when hideExplore is set (first-run setup)", () => {
    instance.accessMode = InstanceAccessMode.PUBLIC;
    renderLayout({ hideExplore: true });

    expect(screen.queryByRole("link", { name: /auth\.explore-public-memos/ })).not.toBeInTheDocument();
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
