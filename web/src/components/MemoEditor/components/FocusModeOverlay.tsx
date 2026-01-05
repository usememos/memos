import { Minimize2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FOCUS_MODE_STYLES } from "../constants";
import type { FocusModeExitButtonProps, FocusModeOverlayProps } from "../types";

export function FocusModeOverlay({ isActive, onToggle }: FocusModeOverlayProps) {
  if (!isActive) return null;

  return <button type="button" className={FOCUS_MODE_STYLES.backdrop} onClick={onToggle} aria-label="Exit focus mode" />;
}

export function FocusModeExitButton({ isActive, onToggle, title }: FocusModeExitButtonProps) {
  if (!isActive) return null;

  return (
    <Button variant="ghost" size="icon" className={FOCUS_MODE_STYLES.exitButton} onClick={onToggle} title={title}>
      <Minimize2Icon className="w-4 h-4" />
    </Button>
  );
}
