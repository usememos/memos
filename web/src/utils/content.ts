import type { Memo } from "@/types/proto/api/v1/memo_service_pb";
import type { AttachmentItem } from "@/components/memo-metadata";

/**
 * Downloads a file using a temporary anchor element
 * @param url - The URL to download from
 * @param filename - The filename to save as
 * @param isLocal - Whether this is a local file that needs special handling
 */
const downloadFile = (
  url: string,
  filename: string,
  isLocal: boolean = false,
): void => {
  const downloadElement = document.createElement("a");
  downloadElement.href = url;
  downloadElement.download = filename;

  // For local files, ensure proper download behavior
  if (isLocal) {
    downloadElement.setAttribute("download", filename);
    downloadElement.target = "_blank";
  }

  document.body.appendChild(downloadElement);
  downloadElement.click();
  document.body.removeChild(downloadElement);
};

/**
 * Creates a date prefix in YYYY/MM/DD format
 * @param date - Date object to format (defaults to current date)
 * @returns Formatted date string
 */
const createDatePrefix = (date: Date = new Date()): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}/${month}/${day}`;
};

/**
 * Extracts memo short name from full name path
 * @param memoName - Full memo name (format: memos/{id})
 * @returns Short memo name
 */
const extractMemoName = (memoName: string): string => {
  return memoName.split("/").pop() || "memo";
};

/**
 * Downloads memo content as a markdown file if content exists
 * @param memo - The memo object
 * @param namePrefix - The filename prefix to use
 */
const downloadMemoContent = (memo: Memo, namePrefix: string): void => {
  if (!memo.content || !memo.content.trim()) {
    return;
  }

  const contentBlob = new Blob([memo.content], {
    type: "text/markdown;charset=utf-8",
  });
  const contentUrl = URL.createObjectURL(contentBlob);

  downloadFile(contentUrl, `${namePrefix}.md`);

  URL.revokeObjectURL(contentUrl);
};

/**
 * Downloads all attachments from a memo
 * @param attachmentItems - Array of attachment items
 * @param namePrefix - The filename prefix to use
 */
const downloadAttachments = (
  attachmentItems: AttachmentItem[],
  namePrefix: string,
): void => {
  attachmentItems.forEach((item) => {
    downloadFile(
      item.sourceUrl,
      `${namePrefix} - ${item.filename}`,
      item.isLocal,
    );
  });
};

/**
 * Downloads all content and attachments from a memo
 * @param memo - The memo object
 * @param attachmentItems - Array of attachment items
 */
export const downloadMemoContentAndAttachments = (
  memo: Memo,
  attachmentItems: AttachmentItem[],
): void => {
  const date = new Date();
  const datePrefix = createDatePrefix(date);
  const memoShortName = extractMemoName(memo.name);
  const namePrefix = `${datePrefix} ${memoShortName}`;

  // Download memo content first
  downloadMemoContent(memo, namePrefix);

  // Then download all attachments
  downloadAttachments(attachmentItems, namePrefix);
};

// Legacy export for backward compatibility
export const download = downloadMemoContentAndAttachments;
