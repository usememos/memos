import { Button, Tooltip } from "@usememos/ui";
import { Minimize2Icon, XIcon } from "lucide-react";
import { useTranslate } from "@/utils/i18n";
import { FOCUS_MODE_STYLES } from "../constants";
import type { FocusModeExitButtonProps, FocusModeOverlayProps } from "../types";

export function FocusModeOverlay({ isActive, onToggle }: FocusModeOverlayProps) {
  const t = useTranslate();
  if (!isActive) return null;

  return <div className={FOCUS_MODE_STYLES.backdrop} onClick={onToggle} aria-label={t("editor.exit-focus-mode")} />;
}

/** Leaves the frame the editor sits in: minimizes inline focus mode, or closes a host-owned frame. */
export function FocusModeExitButton({ action, onExit }: FocusModeExitButtonProps) {
  const t = useTranslate();
  const label = t(action === "close" ? "common.close" : "editor.exit-focus-mode");
  const Icon = action === "close" ? XIcon : Minimize2Icon;

  return (
    <Tooltip.Root>
      <Tooltip.Trigger render={<Button variant="ghost" size="sm" aria-label={label} onClick={onExit} icon={<Icon />} />} />
      <Tooltip.Popup>{label}</Tooltip.Popup>
    </Tooltip.Root>
  );
}
