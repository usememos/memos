import { timestampDate } from "@bufbuild/protobuf/wkt";
import type { Memo } from "@/types/proto/api/v1/memo_service_pb";

/**
 * Prints a memo as PDF using the browser's print dialog.
 * The browser will show a print preview where users can save as PDF.
 *
 * @param memo - The memo object to print
 */
export const printMemoAsPDF = (memo: Memo) => {
  // Create a new window for printing
  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    throw new Error("Failed to open print window. Please allow popups for this site.");
  }

  // Get the current theme's styles
  const themeStyles = Array.from(document.styleSheets)
    .map((styleSheet) => {
      try {
        return Array.from(styleSheet.cssRules)
          .map((rule) => rule.cssText)
          .join("\n");
      } catch (e) {
        // Cross-origin stylesheets may throw an error
        return "";
      }
    })
    .join("\n");

  // Get memo content
  const memoContent = document.querySelector(`[data-memo-name="${memo.name}"] .markdown-content`)?.innerHTML || memo.content;

  // Format timestamps
  const createTime = memo.createTime ? timestampDate(memo.createTime).toLocaleString() : "Unknown";
  const updateTime = memo.updateTime ? timestampDate(memo.updateTime).toLocaleString() : null;
  const shouldShowUpdateTime = updateTime && memo.updateTime !== memo.createTime;

  // Create the print HTML
  const printHTML = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${memo.name} - Memos</title>
      <style>
        ${themeStyles}
      </style>
    </head>
    <body>
      <div class="memo-print-container">
        <div class="memo-metadata">
          <h1 style="margin: 0 0 8pt 0; font-size: 18pt;">Memo</h1>
          <div style="font-size: 10pt; color: #666; margin-top: 4pt;">
            <p style="margin: 2pt 0;"><strong>Created:</strong> ${createTime}</p>
            ${shouldShowUpdateTime ? `<p style="margin: 2pt 0;"><strong>Updated:</strong> ${updateTime}</p>` : ""}
          </div>
        </div>
        <div class="markdown-content memo-content">
          ${memoContent}
        </div>
      </div>
      <script>
        // Auto-print when the content is loaded
        window.onload = function() {
          window.print();
        };
        
        // Close window after print dialog closes (print, cancel, or save)
        window.onafterprint = function() {
          window.close();
        };
      </script>
    </body>
    </html>
  `;

  // Write the HTML to the new window
  printWindow.document.write(printHTML);
  printWindow.document.close();
};

/**
 * Prints the current page/memo using the browser's print dialog.
 * This is a simpler alternative that doesn't create a new window.
 */
export const printCurrentPage = () => {
  window.print();
};
