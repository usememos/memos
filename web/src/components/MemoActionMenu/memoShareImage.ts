import { toBlob } from "html-to-image";

const WINDOW_HORIZONTAL_MARGIN = 32;
const PREVIEW_HORIZONTAL_PADDING_IN_DIALOG = 40;
const PREVIEW_WIDTH_BOOST_IN_DIALOG = 48;

export const MEMO_SHARE_IMAGE_CONFIG = {
  dialogExtraWidth: 80,
  maxWidth: 520,
  minWidth: 260,
  previewScale: 0.9,
  viewportMargin: 48,
} as const;

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const isExportableImageUrl = (value?: string) => {
  if (!value) {
    return false;
  }

  if (value.startsWith("/") || value.startsWith("data:") || value.startsWith("blob:")) {
    return true;
  }

  try {
    return new URL(value, window.location.origin).origin === window.location.origin;
  } catch {
    return false;
  }
};

const waitForPreviewAssets = async (node: HTMLElement) => {
  try {
    await document.fonts?.ready;
  } catch {
    // Ignore font loading failures and continue with the best available render.
  }

  const images = Array.from(node.querySelectorAll("img"));
  await Promise.all(
    images.map(
      (image) =>
        new Promise<void>((resolve) => {
          if (image.complete) {
            resolve();
            return;
          }

          image.addEventListener("load", () => resolve(), { once: true });
          image.addEventListener("error", () => resolve(), { once: true });
        }),
    ),
  );
};

export const buildMemoShareImageFileName = (memoName: string) => {
  const suffix = memoName.split("/").pop() || "memo";
  return `memo-${suffix}.png`;
};

export const getMemoSharePreviewWidth = (cardWidth: number) => {
  const viewportWidth =
    typeof window === "undefined" ? MEMO_SHARE_IMAGE_CONFIG.maxWidth : window.innerWidth - MEMO_SHARE_IMAGE_CONFIG.viewportMargin;
  const baseWidth = cardWidth || viewportWidth;

  return clamp(
    Math.round(baseWidth * MEMO_SHARE_IMAGE_CONFIG.previewScale),
    MEMO_SHARE_IMAGE_CONFIG.minWidth,
    MEMO_SHARE_IMAGE_CONFIG.maxWidth,
  );
};

export const getMemoShareDialogWidth = (previewWidth: number) => {
  const viewportWidth =
    typeof window === "undefined" ? previewWidth + MEMO_SHARE_IMAGE_CONFIG.dialogExtraWidth : window.innerWidth - WINDOW_HORIZONTAL_MARGIN;
  return Math.min(previewWidth + MEMO_SHARE_IMAGE_CONFIG.dialogExtraWidth, viewportWidth);
};

export const getMemoShareRenderWidth = (previewWidth: number, dialogWidth: number) => {
  const maxRenderWidth = Math.max(MEMO_SHARE_IMAGE_CONFIG.minWidth, dialogWidth - PREVIEW_HORIZONTAL_PADDING_IN_DIALOG);
  return clamp(previewWidth + PREVIEW_WIDTH_BOOST_IN_DIALOG, MEMO_SHARE_IMAGE_CONFIG.minWidth, maxRenderWidth);
};

export const getMemoSharePreviewAvatarUrl = (avatarUrl?: string) => (isExportableImageUrl(avatarUrl) ? avatarUrl : undefined);

export const createMemoShareImageBlob = async (node: HTMLElement) => {
  await waitForPreviewAssets(node);

  const rect = node.getBoundingClientRect();
  const width = Math.ceil(rect.width || node.offsetWidth || node.clientWidth);
  const height = Math.ceil(rect.height || node.offsetHeight || node.clientHeight);

  const blob = await toBlob(node, {
    cacheBust: true,
    height,
    pixelRatio: Math.max(2, Math.min(window.devicePixelRatio || 1, 3)),
    width,
    filter: (currentNode) => {
      if (!(currentNode instanceof HTMLElement)) {
        return true;
      }

      if (currentNode instanceof HTMLImageElement) {
        return isExportableImageUrl(currentNode.currentSrc || currentNode.src);
      }

      return !(currentNode instanceof HTMLVideoElement);
    },
  });

  if (!blob) {
    throw new Error("Failed to render image");
  }

  return blob;
};
