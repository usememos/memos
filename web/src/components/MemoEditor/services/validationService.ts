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

    // Cannot save while already saving
    if (state.ui.isLoading.saving) {
      return { valid: false, reason: "Save in progress" };
    }

    return { valid: true };
  },
};
