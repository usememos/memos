import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SignIn from "@/pages/SignIn";

const state = vi.hoisted(() => ({
  generalSetting: {
    disallowPasswordAuth: true,
  },
  identityProviders: {
    identityProviderList: [] as { name: string; title: string }[],
    isLoading: true,
  },
}));

vi.mock("@/contexts/InstanceContext", () => ({
  useInstance: () => ({
    generalSetting: state.generalSetting,
    profile: { instanceUrl: "" },
  }),
}));

vi.mock("@/hooks/useIdentityProviderQueries", () => ({
  useIdentityProviderList: () => state.identityProviders,
}));

vi.mock("@/components/AuthFooter", () => ({ default: () => null }));

vi.mock("@/components/IdentityProviderButtons", () => ({
  default: ({ identityProviderList }: { identityProviderList: { title: string }[] }) => (
    <div data-testid="identity-providers">{identityProviderList.map((provider) => provider.title).join(", ")}</div>
  ),
}));

vi.mock("@/components/PasswordSignInForm", () => ({
  default: () => <div data-testid="password-sign-in" />,
}));

vi.mock("@/utils/i18n", () => ({
  useTranslate: () => (key: string) => key,
}));

const renderPage = () =>
  render(
    <MemoryRouter>
      <SignIn />
    </MemoryRouter>,
  );

describe("<SignIn>", () => {
  beforeEach(() => {
    state.generalSetting.disallowPasswordAuth = true;
    state.identityProviders.identityProviderList = [];
    state.identityProviders.isLoading = true;
  });

  it("waits for identity providers before choosing the sign-in method", () => {
    const { container, rerender } = renderPage();

    expect(container.querySelector(".animate-pulse")).toBeInTheDocument();
    expect(screen.queryByText("auth.signin-unavailable-title")).not.toBeInTheDocument();
    expect(screen.queryByTestId("password-sign-in")).not.toBeInTheDocument();
    expect(screen.queryByTestId("identity-providers")).not.toBeInTheDocument();

    state.identityProviders.identityProviderList = [{ name: "identityProviders/acme", title: "Acme SSO" }];
    state.identityProviders.isLoading = false;
    rerender(
      <MemoryRouter>
        <SignIn />
      </MemoryRouter>,
    );

    expect(screen.getByTestId("identity-providers")).toHaveTextContent("Acme SSO");
    expect(screen.queryByText("auth.signin-unavailable-title")).not.toBeInTheDocument();
  });

  it("shows the unavailable state only after an empty provider response", () => {
    state.identityProviders.isLoading = false;
    renderPage();

    expect(screen.getByText("auth.signin-unavailable-title")).toBeInTheDocument();
  });
});
