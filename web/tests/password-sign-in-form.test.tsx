import { Code, ConnectError } from "@connectrpc/connect";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import PasswordSignInForm from "@/components/PasswordSignInForm";

const signIn = vi.hoisted(() => vi.fn());

vi.mock("@/auth-state", () => ({ setAccessToken: vi.fn() }));

vi.mock("@/connect", () => ({
  authServiceClient: { signIn },
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ initialize: vi.fn() }),
}));

// The challenge widget reads the instance profile; no challenge is configured here.
vi.mock("@/contexts/InstanceContext", () => ({
  useInstance: () => ({ profile: { challenge: undefined } }),
}));

vi.mock("@/hooks/useNavigateTo", () => ({
  default: () => vi.fn(),
}));

vi.mock("@/utils/i18n", () => ({
  useTranslate: () => (key: string) => key,
  translate: (key: string) => key,
}));

const fill = () => {
  fireEvent.change(screen.getByLabelText("common.username"), { target: { value: "steven" } });
  fireEvent.change(screen.getByLabelText("common.password"), { target: { value: "wrong" } });
  fireEvent.click(screen.getByRole("button", { name: "common.sign-in" }));
};

describe("<PasswordSignInForm>", () => {
  beforeEach(() => {
    signIn.mockReset();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("does not prefill seeded demo credentials", () => {
    render(<PasswordSignInForm />);

    expect(screen.getByLabelText("common.username")).toHaveValue("");
    expect(screen.getByLabelText("common.password")).toHaveValue("");
  });

  it("shows rejected credentials in the form and clears them on edit", async () => {
    signIn.mockRejectedValue(new ConnectError("unmatched username and password", Code.InvalidArgument));
    render(<PasswordSignInForm />);

    fill();

    expect(await screen.findByRole("alert")).toHaveTextContent("auth.incorrect-credentials");
    expect(screen.getByLabelText("common.password")).toHaveAttribute("aria-invalid", "true");

    fireEvent.change(screen.getByLabelText("common.password"), { target: { value: "right" } });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows any other failure in the form with the server's message", async () => {
    signIn.mockRejectedValue(new ConnectError("user has been archived", Code.PermissionDenied));
    render(<PasswordSignInForm />);

    fill();

    expect(await screen.findByRole("alert")).toHaveTextContent("user has been archived");
    expect(screen.getByLabelText("common.password")).not.toHaveAttribute("aria-invalid", "true");
  });

  it("reveals and hides the password", () => {
    render(<PasswordSignInForm />);
    const password = screen.getByLabelText("common.password");

    fireEvent.click(screen.getByRole("button", { name: "auth.show-password" }));
    expect(password).toHaveAttribute("type", "text");

    fireEvent.click(screen.getByRole("button", { name: "auth.hide-password" }));
    expect(password).toHaveAttribute("type", "password");
  });
});
