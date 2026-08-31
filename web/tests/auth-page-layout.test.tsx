import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AuthPageLayout from "@/components/AuthPageLayout";
import { InstanceAccessMode } from "@/types/proto/api/v1/instance_service_pb";

const instance = vi.hoisted(() => ({ instanceUrl: "https://notes.example.com", accessMode: 1 }));

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
    instance.accessMode = InstanceAccessMode.PRIVATE;
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
});
