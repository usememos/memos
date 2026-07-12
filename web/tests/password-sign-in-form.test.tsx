import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import PasswordSignInForm from "@/components/PasswordSignInForm";

vi.mock("@/auth-state", () => ({ setAccessToken: vi.fn() }));

vi.mock("@/connect", () => ({
  authServiceClient: { signIn: vi.fn() },
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ initialize: vi.fn() }),
}));

vi.mock("@/hooks/useNavigateTo", () => ({
  default: () => vi.fn(),
}));

vi.mock("@/utils/i18n", () => ({
  useTranslate: () => (key: string) => key,
}));

describe("<PasswordSignInForm>", () => {
  it("does not prefill seeded demo credentials", () => {
    render(<PasswordSignInForm />);

    expect(screen.getByPlaceholderText("common.username")).toHaveValue("");
    expect(screen.getByPlaceholderText("common.password")).toHaveValue("");
  });
});
