import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import BookmarksImportDialog from "@/components/BookmarksImport/BookmarksImportDialog";

const mocks = vi.hoisted(() => ({
  onOpenChange: vi.fn(),
  start: vi.fn(),
  cancel: vi.fn(),
  reset: vi.fn(),
  progress: {
    status: "idle" as "idle" | "deduping" | "importing" | "done",
    total: 0,
    created: 0,
    skipped: 0,
    failed: 0,
  },
}));

vi.mock("@/components/BookmarksImport/useBookmarkImport", () => ({
  useBookmarkImport: () => ({
    progress: mocks.progress,
    start: mocks.start,
    cancel: mocks.cancel,
    reset: mocks.reset,
  }),
}));

vi.mock("@/utils/i18n", () => ({
  useTranslate: () => (key: string, params?: Record<string, string>) => {
    if (params) {
      return `${key}:${JSON.stringify(params)}`;
    }
    return key;
  },
}));

describe("BookmarksImportDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.progress = {
      status: "idle",
      total: 0,
      created: 0,
      skipped: 0,
      failed: 0,
    };
  });

  it("renders the drag-and-drop zone and rejects non-csv files", async () => {
    render(<BookmarksImportDialog open onOpenChange={mocks.onOpenChange} />);

    const dropzone = screen.getByRole("button", { name: "bookmarks.import-choose-file" });
    expect(dropzone).toBeInTheDocument();

    const pdfFile = new File(["dummy pdf content"], "document.pdf", { type: "application/pdf" });
    fireEvent.drop(dropzone, {
      dataTransfer: {
        files: [pdfFile],
      },
    });

    await waitFor(() => {
      expect(screen.getByText("bookmarks.import-invalid-file")).toBeInTheDocument();
    });
  });

  it("parses valid csv and renders preview count and tag chips", async () => {
    render(<BookmarksImportDialog open onOpenChange={mocks.onOpenChange} />);

    const dropzone = screen.getByRole("button", { name: "bookmarks.import-choose-file" });
    const csvContent =
      "id,title,note,excerpt,url,folder,tags,created,cover,highlights,favorite\n" +
      "1,Test Title,note,,https://example.com,Design,ui,2026-01-01,,,0\n";
    const csvFile = new File([csvContent], "export.csv", { type: "text/csv" });

    fireEvent.drop(dropzone, {
      dataTransfer: {
        files: [csvFile],
      },
    });

    await waitFor(() => {
      expect(screen.getByText('bookmarks.import-preview-count:{"count":"1"}')).toBeInTheDocument();
      expect(screen.getByText("#design (1)")).toBeInTheDocument();
    });

    const startButton = screen.getByRole("button", { name: "bookmarks.import-start" });
    fireEvent.click(startButton);

    expect(mocks.start).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          title: "Test Title",
          url: "https://example.com",
          folder: "Design",
        }),
      ]),
    );
  });

  it("renders progress bar with aria attributes when importing", () => {
    mocks.progress = {
      status: "importing",
      total: 10,
      created: 4,
      skipped: 1,
      failed: 0,
    };

    render(<BookmarksImportDialog open onOpenChange={mocks.onOpenChange} />);

    const progressbar = screen.getByRole("progressbar");
    expect(progressbar).toBeInTheDocument();
    expect(progressbar).toHaveAttribute("aria-valuenow", "50");
    expect(progressbar).toHaveAttribute("aria-valuemin", "0");
    expect(progressbar).toHaveAttribute("aria-valuemax", "100");
  });
});
