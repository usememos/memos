import type { WidgetRender } from "@usememos/editor";
import { buttonClasses } from "@usememos/ui";

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

/** Lucide's CircleAlert, inlined because the widget renders outside React. */
const ALERT_ICON_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/></svg>';

const actionButton = (label: string, onClick: () => void): HTMLButtonElement => {
  const button = document.createElement("button");
  button.type = "button";
  // The kit's ghost button, so it hovers, presses and shows keyboard focus like every other.
  button.className = buttonClasses({ variant: "ghost", size: "sm" });
  button.textContent = label;
  button.addEventListener("click", onClick);
  return button;
};

/**
 * Renders an upload anchor into an editor widget: a rail and the progress or failure
 * message (a spinner or an alert glyph before it), plus Retry / Keep actions once it failed.
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

    const message = document.createElement("span");
    message.className = "memo-upload-anchor-message";
    if (descriptor.status === "uploading") {
      // The kit's spinner, sized like a 14px glyph.
      const spinner = document.createElement("span");
      spinner.className = "mu-spinner mu-icon-sm";
      spinner.setAttribute("aria-hidden", "true");
      message.appendChild(spinner);
    } else {
      message.insertAdjacentHTML("afterbegin", ALERT_ICON_SVG);
    }
    message.append(descriptor.message);
    element.append(rail, message);

    if (descriptor.status === "failed") {
      const actions = document.createElement("span");
      actions.className = "flex gap-1";
      if (descriptor.onRetry) actions.appendChild(actionButton(descriptor.retryLabel, descriptor.onRetry));
      if (descriptor.onKeepAttachments) actions.appendChild(actionButton(descriptor.keepLabel, descriptor.onKeepAttachments));
      element.appendChild(actions);
    }
  };
