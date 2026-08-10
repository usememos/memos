import { findInvalidManagedAttachmentReferences } from "@/utils/managed-attachment";
import type { EditorState } from "../state";

export interface ValidationResult {
  valid: boolean;
  reason?: string;
}

export const validationService = {
  canSave(state: EditorState): ValidationResult {
    // Cannot save while loading initial content
    if (state.ui.isLoading.loading) {
      return { valid: false, reason: "Loading memo content" };
    }

    // Must have content, attachment, or local file
    if (!state.content.trim() && state.metadata.attachments.length === 0 && state.localFiles.length === 0) {
      return { valid: false, reason: "Content, attachment, or file required" };
    }

    // Cannot save while uploading
    if (state.ui.isLoading.uploading) {
      return { valid: false, reason: "Wait for upload to complete" };
    }

    if (state.ui.pendingInlineImageInsertions > 0) {
      return { valid: false, reason: "Resolve image uploads before saving" };
    }

    // The API rejects these outright, so catch them here rather than letting the
    // save fail with an opaque error that doesn't say which URL is at fault.
    const [invalidReference] = findInvalidManagedAttachmentReferences(state.content);
    if (invalidReference) {
      return { valid: false, reason: `Unsupported attachment image URL: ${invalidReference}` };
    }

    // Cannot save while audio recorder is active
    if (state.recorderBusy) {
      return { valid: false, reason: "Finish audio recording before saving" };
    }

    // Cannot save while already saving
    if (state.ui.isLoading.saving) {
      return { valid: false, reason: "Save in progress" };
    }

    return { valid: true };
  },
};
