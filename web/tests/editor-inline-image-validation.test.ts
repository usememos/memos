import { describe, expect, test } from "vitest";
import { validationService } from "@/components/MemoEditor/services/validationService";
import { createInitialState } from "@/components/MemoEditor/state";

describe("inline image editor validation", () => {
  test("blocks saving while an inline image insertion is unresolved", () => {
    const state = createInitialState();
    state.content = "memo";
    state.ui.pendingInlineImageInsertions = 1;

    expect(validationService.canSave(state)).toEqual({
      valid: false,
      reason: "editor.validation.resolve-image-uploads",
    });
  });

  test("allows saving after the insertion is resolved", () => {
    const state = createInitialState();
    state.content = "memo";

    expect(validationService.canSave(state)).toEqual({ valid: true });
  });
});
