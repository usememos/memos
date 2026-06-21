import { type RefObject, useEffect, useState } from "react";
import type { EditorController, FormattingController, ToolbarHeadingLevel } from "../types/editorController";

export interface ActiveMarks {
  bold: boolean;
  italic: boolean;
  code: boolean;
  bulletList: boolean;
  orderedList: boolean;
  taskList: boolean;
  link: boolean;
  headingLevel: ToolbarHeadingLevel | null;
}

const EMPTY_ACTIVE: ActiveMarks = {
  bold: false,
  italic: false,
  code: false,
  bulletList: false,
  orderedList: false,
  taskList: false,
  link: false,
  headingLevel: null,
};

const HEADING_LEVELS: ToolbarHeadingLevel[] = [1, 2, 3];

function sameActiveMarks(a: ActiveMarks, b: ActiveMarks): boolean {
  return (
    a.bold === b.bold &&
    a.italic === b.italic &&
    a.code === b.code &&
    a.bulletList === b.bulletList &&
    a.orderedList === b.orderedList &&
    a.taskList === b.taskList &&
    a.link === b.link &&
    a.headingLevel === b.headingLevel
  );
}

function readActiveMarks(controller: FormattingController): ActiveMarks {
  const headingLevel = HEADING_LEVELS.find((level) => controller.isActive("heading", { level })) ?? null;
  return {
    bold: controller.isActive("bold"),
    italic: controller.isActive("italic"),
    code: controller.isActive("code"),
    bulletList: controller.isActive("bulletList"),
    orderedList: controller.isActive("orderedList"),
    taskList: controller.isActive("taskList"),
    link: controller.isActive("link"),
    headingLevel,
  };
}

/**
 * Subscribes to the editor controller and recomputes which marks/nodes are
 * active whenever the selection or document changes, so toolbar buttons can
 * highlight live. Returns the empty map until a controller is available.
 */
export function useEditorActiveState(controllerRef: RefObject<(EditorController & FormattingController) | null>): ActiveMarks {
  const [active, setActive] = useState<ActiveMarks>(EMPTY_ACTIVE);
  useEffect(() => {
    const controller = controllerRef.current;
    if (!controller) {
      return;
    }
    // Fires on every transaction; keep the previous object identity when the
    // derived map is unchanged (the common case while typing) so React skips
    // the toolbar re-render.
    const recompute = () => {
      const next = readActiveMarks(controller);
      setActive((prev) => (sameActiveMarks(prev, next) ? prev : next));
    };
    recompute();
    return controller.subscribe(recompute);
  }, [controllerRef]);
  return active;
}
