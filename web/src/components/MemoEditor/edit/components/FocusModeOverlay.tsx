import { Minimize2Icon, MinusIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslate } from "@/utils/i18n";
import { FOCUS_MODE_STYLES } from "../constants";
import type { FocusModeExitButtonProps, FocusModeOverlayProps } from "../types";

export function FocusModeOverlay({ isActive, onToggle }: FocusModeOverlayProps) {
  if (!isActive) return null;

  return <div className={FOCUS_MODE_STYLES.backdrop} onClick={onToggle} aria-label="Exit focus mode" />;
}

/** Collapses inline focus mode until the next text insertion. */
export function FocusModeTemporaryCollapseButton({ onCollapse }: { onCollapse: () => void }) {
  const t = useTranslate();
  const label = t("editor.temporarily-collapse-focus-mode");

  return (
    <Button variant="quiet" size="icon-compact" aria-label={label} title={label} onClick={onCollapse}>
      <MinusIcon className="size-4" strokeWidth={1.8} />
    </Button>
  );
}

/** Leaves the frame the editor sits in: minimizes inline focus mode, or closes a host-owned frame. */
export function FocusModeExitButton({ action, onExit }: FocusModeExitButtonProps) {
  const t = useTranslate();
  const label = t(action === "close" ? "common.close" : "editor.exit-focus-mode");
  const Icon = action === "close" ? XIcon : Minimize2Icon;

  return (
    <Button variant="quiet" size="icon-compact" aria-label={label} title={label} onClick={onExit}>
      <Icon className="size-4" strokeWidth={1.8} />
    </Button>
  );
}
