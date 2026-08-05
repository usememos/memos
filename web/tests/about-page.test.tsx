import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import About from "@/pages/About";

const mockInstance = {
  profile: {
    version: "0.25.0",
    commit: "0123456789abcdef0123456789abcdef01234567",
    instanceUrl: "",
    demo: false,
    admin: undefined as { username: string; displayName: string } | undefined,
  },
  generalSetting: {} as { customProfile?: { title: string; description: string; logoUrl: string } },
};

vi.mock("@/contexts/InstanceContext", () => ({
  useInstance: () => mockInstance,
}));

vi.mock("@/utils/i18n", () => ({
  useTranslate: () => (key: string) =>
    (
      {
        "common.version": "Version",
        "about.powered-by": "Powered by Memos",
      } as Record<string, string>
    )[key] ?? key,
}));

const renderAbout = () => render(<About />);

describe("<About>", () => {
  beforeEach(() => {
    mockInstance.profile = {
      version: "0.25.0",
      commit: "0123456789abcdef0123456789abcdef01234567",
      instanceUrl: "https://notes.example.com",
      demo: false,
      admin: { username: "steven", displayName: "Steven" },
    };
    mockInstance.generalSetting = {};
  });

  afterEach(() => {
    document.documentElement.removeAttribute("data-theme");
  });

  it("renders the identity hero with linked version, commit, and license chips", () => {
    renderAbout();

    expect(screen.getByRole("heading", { name: "Memos" })).toBeInTheDocument();
    expect(screen.getByText(/Capture first/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "v0.25.0" })).toHaveAttribute("href", "https://github.com/usememos/memos/releases/tag/v0.25.0");
    expect(screen.getByRole("link", { name: "0123456" })).toHaveAttribute(
      "href",
      "https://github.com/usememos/memos/commit/0123456789abcdef0123456789abcdef01234567",
    );
    expect(screen.getByRole("link", { name: "MIT" })).toHaveAttribute("href", "https://github.com/usememos/memos/blob/main/LICENSE");
  });

  it("links to the project homepage, docs, API docs, GitHub, and Web Clipper", () => {
    renderAbout();

    expect(screen.getByRole("link", { name: /about\.official-website/ })).toHaveAttribute("href", "https://usememos.com/");
    expect(screen.getByRole("link", { name: /about\.documents/ })).toHaveAttribute("href", "https://usememos.com/docs");
    expect(screen.getByRole("link", { name: /about\.api-docs/ })).toHaveAttribute("href", "https://usememos.com/docs/api");
    expect(screen.getByRole("link", { name: /about\.web-clipper/ })).toHaveAttribute("href", "https://github.com/usememos/web-clipper");
    expect(screen.getByRole("link", { name: /about\.github-repository/ })).toHaveAttribute("href", "https://github.com/usememos/memos");
  });

  it("does not surface the instance URL, administrator, or birds", () => {
    renderAbout();

    expect(screen.queryByText("https://notes.example.com")).not.toBeInTheDocument();
    expect(screen.queryByText("Administrator")).not.toBeInTheDocument();
    expect(screen.queryByText("Steven")).not.toBeInTheDocument();
    expect(screen.queryByText("Birds")).not.toBeInTheDocument();
    expect(screen.queryByTestId("about-bird-sprite")).not.toBeInTheDocument();
  });

  it("shows a plain version chip and no commit chip on dev builds", () => {
    mockInstance.profile.version = "dev";
    mockInstance.profile.commit = "unknown";

    renderAbout();

    expect(screen.getByText("dev")).toBeInTheDocument();
    expect(screen.queryByText("vdev")).not.toBeInTheDocument();
    expect(screen.queryByText(/unknown/)).not.toBeInTheDocument();
  });

  it("shows the demo badge on demo instances", () => {
    mockInstance.profile.demo = true;

    renderAbout();

    expect(screen.getByText("about.demo")).toBeInTheDocument();
  });

  it("uses custom branding for the identity hero and credits Memos", () => {
    mockInstance.generalSetting = {
      customProfile: { title: "Team Notes", description: "Our shared scratchpad.", logoUrl: "/custom-logo.png" },
    };

    renderAbout();

    expect(screen.getByRole("heading", { name: "Team Notes" })).toBeInTheDocument();
    expect(screen.getByText("Our shared scratchpad.")).toBeInTheDocument();
    expect(screen.getByText("Powered by Memos")).toBeInTheDocument();
  });

  it("renders as a page without nested mobile padding", () => {
    const { container } = renderAbout();

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    const contentWrapper = container.querySelector("section > div");
    expect(contentWrapper).toHaveClass("w-full");
    expect(contentWrapper).not.toHaveClass("px-4");
  });
});
