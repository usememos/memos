import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { HabitDraft } from "@/hooks/useHabits";
import type { Habit } from "@/types/proto/api/v1/habit_service_pb";

const localDate = () => new Date().toLocaleDateString("en-CA");
const emptyDraft = (): HabitDraft => ({
  title: "Reading",
  identity: "Become a reader",
  cue: "After morning coffee, I will read",
  environment: "Keep the book on the coffee table",
  minimumValue: 2,
  targetValue: 20,
  startDate: localDate(),
});

interface Props {
  open: boolean;
  habit?: Habit;
  pending?: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (draft: HabitDraft) => Promise<void>;
  onDelete?: () => void;
}

const HabitFormDialog = ({ open, habit, pending, onOpenChange, onSave, onDelete }: Props) => {
  const [draft, setDraft] = useState<HabitDraft>(emptyDraft);
  const [error, setError] = useState("");
  useEffect(() => {
    if (open)
      setDraft(
        habit
          ? {
              title: habit.title,
              identity: habit.identity,
              cue: habit.cue,
              environment: habit.environment,
              minimumValue: habit.minimumValue,
              targetValue: habit.targetValue,
              startDate: habit.startDate,
            }
          : emptyDraft(),
      );
  }, [habit, open]);
  const field = (key: keyof HabitDraft, value: string | number) => setDraft((current) => ({ ...current, [key]: value }));
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    if (!draft.title.trim()) {
      setError("Give the habit a name.");
      return;
    }
    if (draft.minimumValue <= 0 || draft.targetValue < draft.minimumValue) {
      setError("The target must be at least as large as the positive minimum.");
      return;
    }
    try {
      await onSave(draft);
      onOpenChange(false);
    } catch {
      setError("Could not save the habit. Please try again.");
    }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <form onSubmit={submit} className="space-y-5">
          <DialogHeader>
            <DialogTitle>{habit ? "Edit habit" : "Create your first habit"}</DialogTitle>
            <DialogDescription>Design the action and the environment, then let the numbers show the trend.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-1.5 text-sm">
              <span>Habit</span>
              <Input value={draft.title} onChange={(e) => field("title", e.target.value)} autoFocus />
            </label>
            <label className="space-y-1.5 text-sm">
              <span>Identity</span>
              <Input value={draft.identity} onChange={(e) => field("identity", e.target.value)} placeholder="Become a reader" />
            </label>
            <label className="space-y-1.5 text-sm sm:col-span-2">
              <span>Habit stack</span>
              <Input value={draft.cue} onChange={(e) => field("cue", e.target.value)} placeholder="After coffee, I will read" />
            </label>
            <label className="space-y-1.5 text-sm sm:col-span-2">
              <span>Environment cue</span>
              <Input
                value={draft.environment}
                onChange={(e) => field("environment", e.target.value)}
                placeholder="Keep the book on the table"
              />
            </label>
            <label className="space-y-1.5 text-sm">
              <span>Minimum minutes</span>
              <Input type="number" min={1} value={draft.minimumValue} onChange={(e) => field("minimumValue", Number(e.target.value))} />
            </label>
            <label className="space-y-1.5 text-sm">
              <span>Performance target</span>
              <Input type="number" min={1} value={draft.targetValue} onChange={(e) => field("targetValue", Number(e.target.value))} />
            </label>
            <label className="space-y-1.5 text-sm">
              <span>Start date</span>
              <Input type="date" value={draft.startDate} onChange={(e) => field("startDate", e.target.value)} />
            </label>
          </div>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <DialogFooter>
            {habit && onDelete && (
              <Button type="button" variant="destructive" className="sm:me-auto" onClick={onDelete}>
                Delete
              </Button>
            )}
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Save habit"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
export default HabitFormDialog;
