import type { Translations } from "@/utils/i18n";
import { findInvalidManagedAttachmentReferences } from "@/utils/managed-attachment";
import type { EditorState } from "../state";

export interface ValidationResult {
  valid: boolean;
  reason?: Translations;
  detail?: string;
}

export const validationService = {
  canSave(state: EditorState): ValidationResult {
    // Cannot save while loading initial content
    if (state.ui.isLoading.loading) {
      return { valid: false, reason: "editor.validation.loading-content" };
    }

    // Must have content, attachment, or local file
    if (!state.content.trim() && state.metadata.attachments.length === 0 && state.localFiles.length === 0) {
      return { valid: false, reason: "editor.validation.content-required" };
    }

    // Cannot save while uploading
    if (state.ui.isLoading.uploading) {
      return { valid: false, reason: "editor.validation.wait-for-upload" };
    }

    if (state.ui.pendingInlineImageInsertions > 0) {
      return { valid: false, reason: "editor.validation.resolve-image-uploads" };
    }

    // The API rejects these outright, so catch them here rather than letting the
    // save fail with an opaque error that doesn't say which URL is at fault.
    const [invalidReference] = findInvalidManagedAttachmentReferences(state.content);
    if (invalidReference) {
      return { valid: false, reason: "editor.validation.unsupported-attachment-image-url", detail: invalidReference };
    }

    // Cannot save while audio recorder is active
    if (state.recorderBusy) {
      return { valid: false, reason: "editor.validation.finish-audio-recording" };
    }

    // Cannot save while already saving
    if (state.ui.isLoading.saving) {
      return { valid: false, reason: "editor.validation.save-in-progress" };
    }

    return { valid: true };
  },
};
