import type { WidgetRender } from "@usememos/editor";

export type UploadAnchorStatus = "uploading" | "failed";

export interface UploadAnchorDescriptor {
  id: string;
  status: UploadAnchorStatus;
  completed: number;
  total: number;
  message: string;
  retryLabel: string;
  keepLabel: string;
  onRetry?: () => void;
  onKeepAttachments?: () => void;
}

const actionButton = (label: string, onClick: () => void): HTMLButtonElement => {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "memo-upload-anchor-action";
  button.textContent = label;
  button.addEventListener("click", onClick);
  return button;
};

/**
 * Renders an upload anchor into an editor widget: a rail and a badge holding
 * the progress or failure message, plus Retry / Keep actions once it failed.
 * The widget sits after the block the upload was started in; it is never saved
 * and is not part of undo history.
 */
export const renderUploadAnchor =
  (descriptor: UploadAnchorDescriptor): WidgetRender =>
  (element) => {
    element.className = "memo-upload-anchor";
    element.dataset.status = descriptor.status;
    element.setAttribute("role", "status");
    element.setAttribute("aria-live", "polite");
    element.replaceChildren();

    const rail = document.createElement("span");
    rail.className = "memo-upload-anchor-rail";

    const badge = document.createElement("span");
    badge.className = "memo-upload-anchor-badge";
    if (descriptor.status === "uploading") {
      const spinner = document.createElement("span");
      spinner.className = "memo-upload-anchor-spinner";
      spinner.setAttribute("aria-hidden", "true");
      badge.appendChild(spinner);
    }
    badge.append(descriptor.message);
    element.append(rail, badge);

    if (descriptor.status === "failed") {
      const actions = document.createElement("span");
      actions.className = "memo-upload-anchor-actions";
      if (descriptor.onRetry) actions.appendChild(actionButton(descriptor.retryLabel, descriptor.onRetry));
      if (descriptor.onKeepAttachments) actions.appendChild(actionButton(descriptor.keepLabel, descriptor.onKeepAttachments));
      element.appendChild(actions);
    }
  };
