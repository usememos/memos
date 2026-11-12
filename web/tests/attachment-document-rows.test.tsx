import { create } from "@bufbuild/protobuf";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AttachmentRows } from "@/components/MemoMetadata/Attachment/AttachmentListView";
import { AttachmentSchema } from "@/types/proto/api/attachment_service_pb";

const renderDocument = (fields: { filename: string; type: string; externalLink?: string }) =>
  render(<AttachmentRows audio={[]} docs={[create(AttachmentSchema, { name: "attachments/doc", ...fields })]} />);

describe("<AttachmentRows> document rows", () => {
  it("opens a PDF in a new tab and offers its download separately", () => {
    renderDocument({ filename: "report.pdf", type: "application/pdf" });

    const open = screen.getByTitle("Open report.pdf");
    expect(open.getAttribute("target")).toBe("_blank");
    expect(open.hasAttribute("download")).toBe(false);
    const download = screen.getByLabelText("Download report.pdf");
    expect(download.tagName).toBe("A");
    expect(download.hasAttribute("download")).toBe(true);
    expect(download.getAttribute("href")).toBe(open.getAttribute("href"));
  });

  it("downloads a file the browser would not show inline", () => {
    renderDocument({ filename: "notes.txt", type: "text/plain" });

    const row = screen.getByTitle("Download notes.txt");
    expect(row.hasAttribute("download")).toBe(true);
    expect(row.hasAttribute("target")).toBe(false);
    expect(screen.queryByTitle(/^Open /)).toBeNull();
  });

  it("treats a share link as a file on this instance", () => {
    renderDocument({
      filename: "notes.txt",
      type: "text/plain",
      externalLink: `${window.location.origin}/file/attachments/doc/notes.txt?share_token=abc`,
    });

    expect(screen.getByTitle("Download notes.txt").hasAttribute("download")).toBe(true);
  });

  it("opens a link to another site in a new tab", () => {
    renderDocument({ filename: "spec.docx", type: "application/msword", externalLink: "https://example.com/spec.docx" });

    const row = screen.getByTitle("Open spec.docx");
    expect(row.getAttribute("href")).toBe("https://example.com/spec.docx");
    expect(row.getAttribute("target")).toBe("_blank");
    expect(row.hasAttribute("download")).toBe(false);
  });

  it("opens a link that does not parse instead of failing the render", () => {
    renderDocument({ filename: "broken.docx", type: "application/msword", externalLink: "http://[" });

    const row = screen.getByTitle("Open broken.docx");
    expect(row.getAttribute("target")).toBe("_blank");
  });
});
