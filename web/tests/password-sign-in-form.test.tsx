import { Code, ConnectError } from "@connectrpc/connect";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import PasswordSignInForm from "@/components/PasswordSignInForm";

const signIn = vi.hoisted(() => vi.fn());
const initialize = vi.hoisted(() => vi.fn());
const navigateTo = vi.hoisted(() => vi.fn());

vi.mock("@/auth-state", () => ({ setAccessToken: vi.fn() }));

vi.mock("@/connect", () => ({
  authServiceClient: { signIn },
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ initialize }),
}));

// The challenge widget reads the instance profile; no challenge is configured here.
vi.mock("@/contexts/InstanceContext", () => ({
  useInstance: () => ({ profile: { challenge: undefined } }),
}));

vi.mock("@/hooks/useNavigateTo", () => ({
  default: () => navigateTo,
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
    initialize.mockResolvedValue(undefined);
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

  it("keeps the login label and focus while signing in and initializing the session", async () => {
    let finishSignIn!: () => void;
    let finishInitialize!: () => void;
    signIn.mockReturnValue(new Promise((resolve) => (finishSignIn = () => resolve({}))));
    initialize.mockReturnValue(new Promise<void>((resolve) => (finishInitialize = resolve)));
    render(<PasswordSignInForm redirectPath="/memos/example" />);
    const button = screen.getByRole("button", { name: "common.sign-in" });
    const label = button.querySelector(".mu-button-label");
    expect(button.firstElementChild).toBe(label);
    act(() => button.focus());

    fill();
    fireEvent.submit(button.closest("form")!);

    expect(signIn).toHaveBeenCalledOnce();
    expect(button).toHaveAccessibleName("common.sign-in");
    expect(button).toHaveAccessibleDescription("auth.signing-in");
    expect(button).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByLabelText("common.username")).toHaveAttribute("readonly");
    expect(screen.getByLabelText("common.password")).toHaveAttribute("readonly");
    await waitFor(() => expect(button.firstElementChild).toHaveClass("mu-spinner"));
    expect(button).toHaveTextContent("common.sign-in");
    expect(button).toHaveFocus();

    await act(async () => finishSignIn());
    expect(initialize).toHaveBeenCalledOnce();
    expect(navigateTo).not.toHaveBeenCalled();
    expect(button).toHaveAttribute("aria-busy", "true");

    await act(async () => finishInitialize());
    expect(navigateTo).toHaveBeenCalledWith("/memos/example", { replace: true });
  });

  it("restores the same login button after failure and allows retry", async () => {
    signIn.mockRejectedValueOnce(new ConnectError("offline", Code.Unavailable));
    render(<PasswordSignInForm />);
    const button = screen.getByRole("button", { name: "common.sign-in" });
    const label = button.querySelector(".mu-button-label");

    fill();

    await screen.findByRole("alert");
    expect(screen.getByRole("button", { name: "common.sign-in" })).toBe(button);
    expect(button).not.toHaveAttribute("aria-busy");
    expect(button).not.toHaveAttribute("aria-description");
    expect(button.firstElementChild).toBe(label);
    expect(screen.getByLabelText("common.password")).not.toHaveAttribute("readonly");

    signIn.mockResolvedValueOnce({});
    fill();
    await waitFor(() => expect(navigateTo).toHaveBeenCalledOnce());
    expect(signIn).toHaveBeenCalledTimes(2);
  });
});
