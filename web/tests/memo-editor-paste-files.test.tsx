import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import MemoEditor from "@/components/MemoEditor";
import { uploadService } from "@/components/MemoEditor/services";

vi.mock("@/utils/i18n", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/utils/i18n")>()),
  useTranslate: () => (key: string) => key,
}));
vi.mock("@/hooks/useUserQueries", () => ({ useTagCounts: () => ({ data: {} }) }));
vi.mock("@/hooks/useCurrentUser", () => ({ default: () => ({ name: "users/1" }) }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ userGeneralSetting: {} }) }));
vi.mock("@/contexts/InstanceContext", () => ({
  useInstance: () => ({ aiSetting: { providers: [], transcription: undefined }, fetchSetting: vi.fn().mockResolvedValue(undefined) }),
}));
vi.mock("@/contexts/NewMemoContext", () => ({ useNewMemo: () => ({ markNewMemo: vi.fn() }) }));
vi.mock("@/connect", () => ({ attachmentServiceClient: {}, memoServiceClient: {}, userServiceClient: {} }));
vi.stubGlobal("matchMedia", () => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
vi.stubGlobal(
  "ResizeObserver",
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
);
// jsdom has no object URLs; local files are keyed by this value, so keep it unique per file.
URL.createObjectURL = (blob) => `blob:${(blob as File).name}`;
URL.revokeObjectURL = () => {};

const paste = (target: Element, files: File[]) => {
  const event = new Event("paste", { bubbles: true, cancelable: true });
  Object.defineProperty(event, "clipboardData", {
    value: { items: files.map((file) => ({ kind: "file", getAsFile: () => file })) },
  });
  target.dispatchEvent(event);
  return event;
};

const mount = () => {
  const client = new QueryClient();
  const result = render(
    <QueryClientProvider client={client}>
      <MemoEditor cacheKey="paste-test" />
    </QueryClientProvider>,
  );
  const content = result.container.querySelector<HTMLElement>(".cm-content");
  expect(content).not.toBeNull();
  return { ...result, content: content! };
};

describe("MemoEditor paste", () => {
  it("attaches pasted files instead of writing images into the text", async () => {
    const upload = vi.spyOn(uploadService, "uploadFile");
    const { content, container } = mount();
    const pdf = new File(["%PDF"], "notes.pdf", { type: "application/pdf" });
    const image = new File(["png"], "image.png", { type: "image/png" });

    const event = paste(content, [pdf, image]);

    expect(event.defaultPrevented).toBe(true);
    await waitFor(() => expect(container.textContent).toContain(image.name));
    expect(container.textContent).toContain(pdf.name);
    // A paste has no placement gesture: the image is attached rather than
    // inlined, so no inline upload starts and the text stays untouched.
    expect(content.textContent).toBe("");
    expect(upload).not.toHaveBeenCalled();
  });
});
