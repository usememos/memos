import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AuthPageLayout from "@/components/AuthPageLayout";

const instance = vi.hoisted(() => ({ instanceUrl: "" }));

vi.mock("@/contexts/InstanceContext", () => ({
  useInstance: () => ({ profile: instance, generalSetting: {} }),
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
    instance.instanceUrl = "";
  });

  it("links to Explore on public instances", () => {
    instance.instanceUrl = "https://demo.example.com";
    renderLayout();

    expect(screen.getByRole("link", { name: /auth\.explore-public-memos/ })).toHaveAttribute("href", "/explore");
  });

  it("omits the band on private instances", () => {
    renderLayout();

    expect(screen.queryByRole("link", { name: /auth\.explore-public-memos/ })).not.toBeInTheDocument();
  });

  it("omits the band when hideExplore is set (first-run setup)", () => {
    instance.instanceUrl = "https://demo.example.com";
    renderLayout({ hideExplore: true });

    expect(screen.queryByRole("link", { name: /auth\.explore-public-memos/ })).not.toBeInTheDocument();
  });
});
