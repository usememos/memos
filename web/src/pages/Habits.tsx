import { FlameIcon, PlusIcon, Volume2Icon, VolumeXIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "react-hot-toast";
import ConfirmDialog from "@/components/ConfirmDialog";
import HabitCelebrationOverlay from "@/components/Habits/HabitCelebrationOverlay";
import HabitFormDialog from "@/components/Habits/HabitFormDialog";
import HabitMomentumDashboard from "@/components/Habits/HabitMomentumDashboard";
import { classifyHabitReward, type HabitCelebrationEvent } from "@/components/Habits/habitCelebration";
import { playHabitSound, prepareHabitAudio, stopHabitSounds } from "@/components/Habits/habitSounds";
import { Button } from "@/components/ui/button";
import {
  type HabitDraft,
  useCreateHabit,
  useDeleteHabit,
  useDeleteHabitLog,
  useHabitSummary,
  useHabits,
  useUpdateHabit,
  useUpsertHabitLog,
} from "@/hooks/useHabits";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import type { HabitSummary } from "@/types/proto/api/v1/habit_service_pb";

const today = () => new Date().toLocaleDateString("en-CA");
const HABIT_SOUND_STORAGE_KEY = "memos.habits.sound-enabled.v1";

const Habits = () => {
  const date = today();
  const { data: habits = [], isLoading, isError, refetch } = useHabits();
  const [selectedName, setSelectedName] = useState<string>();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [soundEnabled, setSoundEnabled] = useLocalStorage(HABIT_SOUND_STORAGE_KEY, true);
  const [celebration, setCelebration] = useState<HabitCelebrationEvent | null>(null);
  const celebrationReturnFocusRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (!selectedName && habits[0]) setSelectedName(habits[0].name);
    else if (selectedName && !habits.some((habit) => habit.name === selectedName)) setSelectedName(habits[0]?.name);
  }, [habits, selectedName]);
  const selected = habits.find((habit) => habit.name === selectedName);
  const scheduled = Boolean(selected && selected.startDate > date);
  const {
    data: summary,
    isLoading: summaryLoading,
    isError: summaryError,
    refetch: refetchSummary,
  } = useHabitSummary(selectedName, date, !scheduled);
  const createHabit = useCreateHabit();
  const updateHabit = useUpdateHabit();
  const saveLog = useUpsertHabitLog();
  const deleteLog = useDeleteHabitLog();
  const deleteHabit = useDeleteHabit();
  useEffect(() => {
    setCelebration(null);
    stopHabitSounds();
  }, [selectedName]);
  useEffect(() => () => stopHabitSounds(), []);

  const saveHabit = async (draft: HabitDraft) => {
    if (editing && selected) {
      await updateHabit.mutateAsync({ name: selected.name, draft });
    } else {
      const created = await createHabit.mutateAsync(draft);
      setSelectedName(created.name);
    }
    setEditing(false);
  };
  const saveToday = async (value: number) => {
    if (!selected || !summary) return;

    const before = summary;
    const wasRecorded = Boolean(before.recentDays.find((day) => day.date === date)?.recorded);
    celebrationReturnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setCelebration(null);
    stopHabitSounds();
    if (soundEnabled && !wasRecorded && value >= selected.minimumValue) void prepareHabitAudio();

    await saveLog.mutateAsync({ parent: selected.name, logDate: date, value });

    let after: HabitSummary | undefined;
    try {
      after = (await refetchSummary({ throwOnError: true })).data;
    } catch {
      toast("Progress saved, but the latest score could not be loaded");
      return;
    }

    if (!after) {
      toast("Progress saved, but the latest score could not be loaded");
      return;
    }

    const event = classifyHabitReward({ before, after, value, wasRecorded });
    setCelebration(event);
    if (!event) {
      if (!wasRecorded && value < selected.minimumValue) toast("Today's value saved");
      return;
    }
    if (soundEnabled) void playHabitSound(event.tier);
  };
  if (isLoading) return <div className="mx-auto max-w-6xl py-20 text-center text-muted-foreground">Loading habits…</div>;
  if (isError)
    return (
      <div className="mx-auto max-w-xl py-20 text-center">
        <p className="text-lg font-semibold">Habits could not be loaded.</p>
        <Button className="mt-4" onClick={() => refetch()}>
          Try again
        </Button>
      </div>
    );
  return (
    <div className="mx-auto w-full max-w-7xl">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-2xl bg-warning text-warning-foreground">
            <FlameIcon className="size-5" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-foreground">Habits</h1>
            <p className="text-sm text-muted-foreground">Consistency is the game. Performance is the score.</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <Button
            type="button"
            variant="ghost"
            size="icon-compact"
            aria-label={soundEnabled ? "Mute habit sounds" : "Unmute habit sounds"}
            title={soundEnabled ? "Mute habit sounds" : "Unmute habit sounds"}
            onClick={() => {
              if (soundEnabled) stopHabitSounds();
              setSoundEnabled(!soundEnabled);
            }}
          >
            {soundEnabled ? <Volume2Icon className="size-4" /> : <VolumeXIcon className="size-4" />}
          </Button>
          <Button
            onClick={() => {
              setEditing(false);
              setFormOpen(true);
            }}
          >
            <PlusIcon className="size-4" />
            New habit
          </Button>
        </div>
      </div>
      {habits.length > 1 && (
        <div className="mb-5 flex gap-2 overflow-x-auto pb-1">
          {habits.map((habit) => (
            <button
              type="button"
              key={habit.name}
              onClick={() => setSelectedName(habit.name)}
              className={`shrink-0 rounded-full border px-4 py-2 text-sm ${habit.name === selectedName ? "border-warning bg-warning text-warning-foreground" : "border-border bg-background text-muted-foreground hover:text-foreground"}`}
            >
              {habit.title}
            </button>
          ))}
        </div>
      )}
      {habits.length === 0 ? (
        <section className="flex min-h-[60vh] flex-col items-center justify-center rounded-3xl border border-dashed border-border bg-muted/20 px-6 text-center">
          <div className="flex size-16 items-center justify-center rounded-3xl bg-warning/15 text-warning">
            <FlameIcon className="size-8" />
          </div>
          <h2 className="mt-6 text-2xl font-semibold text-foreground">Build your first chain</h2>
          <p className="mt-2 max-w-md text-muted-foreground">
            Define a tiny minimum, a meaningful target, and the cue that makes starting automatic.
          </p>
          <Button className="mt-6" onClick={() => setFormOpen(true)}>
            <PlusIcon className="size-4" />
            Create a habit
          </Button>
        </section>
      ) : scheduled && selected ? (
        <section className="flex min-h-[50vh] flex-col items-center justify-center rounded-3xl border border-warning/30 bg-warning/5 px-6 text-center">
          <FlameIcon className="size-10 text-warning" />
          <h2 className="mt-5 text-2xl font-semibold text-foreground">{selected.title} starts soon</h2>
          <p className="mt-2 text-muted-foreground">Your first tracking day is {selected.startDate}. The chain begins then.</p>
          <Button
            variant="outline"
            className="mt-6"
            onClick={() => {
              setEditing(true);
              setFormOpen(true);
            }}
          >
            Edit habit
          </Button>
        </section>
      ) : summary && selected ? (
        <HabitMomentumDashboard
          summary={summary}
          today={date}
          saving={saveLog.isPending || deleteLog.isPending}
          onLog={saveToday}
          onUndo={() => deleteLog.mutateAsync({ parent: selected.name, logDate: date }).then(() => undefined)}
          onEdit={() => {
            setEditing(true);
            setFormOpen(true);
          }}
        />
      ) : summaryLoading ? (
        <div className="py-20 text-center text-muted-foreground">Calculating momentum…</div>
      ) : summaryError ? (
        <div className="py-20 text-center">
          <p className="text-lg font-semibold text-foreground">Progress could not be calculated.</p>
          <Button className="mt-4" variant="outline" onClick={() => refetchSummary()}>
            Try again
          </Button>
        </div>
      ) : null}
      <HabitCelebrationOverlay
        event={celebration}
        onDismiss={() => setCelebration(null)}
        returnFocus={() => celebrationReturnFocusRef.current}
      />
      <HabitFormDialog
        open={formOpen}
        habit={editing ? selected : undefined}
        pending={createHabit.isPending || updateHabit.isPending}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) setEditing(false);
        }}
        onSave={saveHabit}
        onDelete={() => {
          setFormOpen(false);
          setDeleteOpen(true);
        }}
      />
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={`Delete ${selected?.title ?? "habit"}?`}
        description="This permanently removes the habit and its daily history."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        confirmVariant="destructive"
        onConfirm={async () => {
          if (selected) await deleteHabit.mutateAsync(selected.name);
        }}
      />
    </div>
  );
};
export default Habits;
