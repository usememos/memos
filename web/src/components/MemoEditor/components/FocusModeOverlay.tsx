import { Minimize2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FOCUS_MODE_STYLES } from "../constants";

interface FocusModeOverlayProps {
  isActive: boolean;
  onToggle: () => void;
}

export function FocusModeOverlay({ isActive, onToggle }: FocusModeOverlayProps) {
  if (!isActive) return null;

  return (
    <button
      type="button"
      className={FOCUS_MODE_STYLES.backdrop}
      onClick={onToggle}
      onKeyDown={(e) => e.key === "Escape" && onToggle()}
      aria-label="Exit focus mode"
    />
  );
}

interface FocusModeExitButtonProps {
  isActive: boolean;
  onToggle: () => void;
  title: string;
}

export function FocusModeExitButton({ isActive, onToggle, title }: FocusModeExitButtonProps) {
  if (!isActive) return null;

  return (
    <Button variant="ghost" size="icon" className={FOCUS_MODE_STYLES.exitButton} onClick={onToggle} title={title}>
      <Minimize2Icon className="w-4 h-4" />
    </Button>
  );
}
