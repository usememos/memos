import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AuthPageLayout from "@/components/AuthPageLayout";

const instance = vi.hoisted(() => ({ instanceUrl: "", allowPublicAccess: false }));

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
    instance.allowPublicAccess = false;
  });

  it("links to Explore when public access is enabled, even without an instance URL", () => {
    instance.instanceUrl = "";
    instance.allowPublicAccess = true;
    renderLayout();

    expect(screen.getByRole("link", { name: /auth\.explore-public-memos/ })).toHaveAttribute("href", "/explore");
  });

  it("omits the band when the policy is private even though an instance URL is configured", () => {
    instance.instanceUrl = "https://demo.example.com";
    instance.allowPublicAccess = false;
    renderLayout();

    expect(screen.queryByRole("link", { name: /auth\.explore-public-memos/ })).not.toBeInTheDocument();
  });

  it("omits the band when hideExplore is set (first-run setup)", () => {
    instance.instanceUrl = "https://demo.example.com";
    instance.allowPublicAccess = true;
    renderLayout({ hideExplore: true });

    expect(screen.queryByRole("link", { name: /auth\.explore-public-memos/ })).not.toBeInTheDocument();
  });
});
