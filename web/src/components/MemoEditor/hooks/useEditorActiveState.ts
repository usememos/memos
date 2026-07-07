import { type RefObject, useEffect, useState } from "react";
import { type ActiveFormatState, EMPTY_ACTIVE_FORMATS } from "../formatting/commands";
import type { EditorController } from "../types/editorController";

// Derive the key set from the canonical empty snapshot so a command added to
// ActiveFormatState is compared automatically (all fields are primitives).
const ACTIVE_FORMAT_KEYS = Object.keys(EMPTY_ACTIVE_FORMATS) as (keyof ActiveFormatState)[];

function sameActiveFormats(a: ActiveFormatState, b: ActiveFormatState): boolean {
  return ACTIVE_FORMAT_KEYS.every((key) => a[key] === b[key]);
}

/**
 * Subscribes to the editor's formatting capability and recomputes which
 * marks/nodes are active whenever the selection or document changes, so toolbar
 * buttons can highlight live. Returns the empty snapshot until a formatting-
 * capable controller is available (e.g. raw mode, which has none).
 */
export function useEditorActiveState(controllerRef: RefObject<EditorController | null>): ActiveFormatState {
  const [active, setActive] = useState<ActiveFormatState>(EMPTY_ACTIVE_FORMATS);
  useEffect(() => {
    const formatting = controllerRef.current?.formatting;
    if (!formatting) {
      return;
    }
    // Fires on every transaction; keep the previous object identity when the
    // derived snapshot is unchanged (the common case while typing) so React
    // skips the toolbar re-render.
    const recompute = () => {
      const next = formatting.getActiveFormats();
      setActive((prev) => (sameActiveFormats(prev, next) ? prev : next));
    };
    recompute();
    return formatting.subscribe(recompute);
  }, [controllerRef]);
  return active;
}
