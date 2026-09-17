import { XIcon } from "lucide-react";
import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { HabitCelebrationEvent } from "./habitCelebration";

interface Props {
  event: HabitCelebrationEvent | null;
  onDismiss: () => void;
  returnFocus?: () => HTMLElement | null;
}

const AUTO_DISMISS_MS = { minimum: 900, target: 1800 } as const;

const CONFETTI = [
  { x: "8%", delay: "0ms", color: "bg-warning" },
  { x: "18%", delay: "90ms", color: "bg-primary" },
  { x: "31%", delay: "30ms", color: "bg-success" },
  { x: "47%", delay: "120ms", color: "bg-warning" },
  { x: "63%", delay: "50ms", color: "bg-primary" },
  { x: "79%", delay: "140ms", color: "bg-success" },
  { x: "91%", delay: "70ms", color: "bg-warning" },
] as const;

const SPARKS = ["12%", "29%", "50%", "71%", "88%"] as const;

const animationStyles = `
  @keyframes habit-confetti {
    0% { opacity: 0; transform: translate3d(0, -18vh, 0) rotate(0deg); }
    12% { opacity: 1; }
    100% { opacity: 0; transform: translate3d(0, 58vh, 0) rotate(460deg); }
  }
  @keyframes habit-firework {
    0% { opacity: 0; transform: translate3d(0, 22px, 0) scale(0.25); }
    18% { opacity: 1; }
    72% { opacity: 1; transform: translate3d(0, 0, 0) scale(1); }
    100% { opacity: 0; transform: translate3d(0, -8px, 0) scale(1.08); }
  }
`;

const CelebrationParticles = ({ tier }: { tier: HabitCelebrationEvent["tier"] }) => (
  <div className="pointer-events-none fixed inset-0 z-overlay overflow-hidden motion-reduce:hidden" data-motion-layer aria-hidden="true">
    {tier !== "minimum" &&
      CONFETTI.map((piece, index) => (
        <span
          // The array is fixed and deterministic; position is the stable identity.
          key={piece.x}
          data-particle
          aria-hidden="true"
          className={cn("absolute top-0 h-3 w-1.5 rounded-full", piece.color)}
          style={{
            left: piece.x,
            animation: `habit-confetti ${tier === "major" ? 2400 : 1800}ms cubic-bezier(0.2, 0.75, 0.25, 1) ${piece.delay} forwards`,
            width: index % 2 === 0 ? "0.45rem" : "0.7rem",
          }}
        />
      ))}
    {SPARKS.slice(0, tier === "minimum" ? 4 : SPARKS.length).map((left, index) => (
      <span
        key={left}
        data-particle
        aria-hidden="true"
        className="absolute top-[17%] size-3 rounded-full bg-warning shadow-[0_0_24px_hsl(var(--warning))]"
        style={{
          left,
          animation: `habit-firework ${tier === "minimum" ? 900 : tier === "target" ? 1800 : 2400}ms ease-out ${index * 70}ms forwards`,
        }}
      />
    ))}
  </div>
);

const HabitCelebrationOverlay = ({ event, onDismiss, returnFocus }: Props) => {
  const continueButtonRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!event || event.tier === "major") return;
    const timeout = window.setTimeout(onDismiss, AUTO_DISMISS_MS[event.tier]);
    return () => window.clearTimeout(timeout);
  }, [event, onDismiss]);

  useEffect(() => {
    if (!event || event.tier === "major") return;
    const onKeyDown = (keyboardEvent: KeyboardEvent) => {
      if (keyboardEvent.key === "Escape") onDismiss();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [event, onDismiss]);

  if (!event) return null;

  const announcement =
    event.tier === "minimum"
      ? `Streak protected. ${event.value} minutes logged.`
      : `Target crushed. ${event.value} minutes logged. ${event.xpAwarded} XP earned.`;

  if (event.tier !== "major") {
    const target = event.tier === "target";
    return (
      <>
        <style>{animationStyles}</style>
        <CelebrationParticles tier={event.tier} />
        <div className="pointer-events-none fixed inset-x-4 top-20 z-overlay flex justify-center sm:top-24">
          <section
            role="status"
            aria-live="polite"
            className={cn(
              "pointer-events-auto relative w-full max-w-md overflow-hidden rounded-3xl border bg-card px-6 py-5 text-center shadow-2xl",
              target ? "border-warning/50" : "border-primary/40",
            )}
          >
            {target && (
              <button
                type="button"
                onClick={onDismiss}
                className="absolute right-3 top-3 rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                aria-label="Close celebration"
              >
                <XIcon className="size-4" />
              </button>
            )}
            <div className="text-4xl" aria-hidden="true">
              {target ? "🎉" : "✨"}
            </div>
            <p className="mt-2 text-xs font-bold uppercase tracking-[0.22em] text-warning">
              {target ? "Target crushed" : "Streak protected"}
            </p>
            <p className="mt-1 text-3xl font-semibold tracking-tight text-foreground">{event.value} minutes</p>
            <p className="mt-2 text-sm text-muted-foreground">
              {target
                ? `${event.xpAwarded} XP earned · ${event.targetValue} minute target`
                : `Minimum cleared · day ${event.currentStreak}`}
            </p>
            <span className="sr-only">{announcement}</span>
          </section>
        </div>
      </>
    );
  }

  const levelReason = event.majorReasons.includes("level");
  const streakReason = event.majorReasons.includes("streak");
  const title = levelReason ? `Level ${event.level} unlocked!` : `${event.currentStreak} day streak!`;

  return (
    <>
      <style>{animationStyles}</style>
      <CelebrationParticles tier="major" />
      <div
        className="pointer-events-none fixed inset-0 z-overlay bg-[radial-gradient(circle_at_center,hsl(var(--warning)/0.18),transparent_58%)] motion-reduce:bg-none"
        aria-hidden="true"
      />
      <Dialog open onOpenChange={(open) => !open && onDismiss()}>
        <DialogContent
          className="overflow-visible border-warning/40 bg-card text-center shadow-[0_24px_100px_hsl(var(--warning)/0.2)]"
          showCloseButton
          initialFocus={continueButtonRef}
          finalFocus={returnFocus}
        >
          <div className="text-6xl motion-safe:animate-bounce" aria-hidden="true">
            🏆
          </div>
          <DialogTitle className="text-center text-3xl text-foreground">{title}</DialogTitle>
          <DialogDescription className="text-center text-base leading-7">
            {levelReason && streakReason
              ? `Level ${event.level} and a ${event.currentStreak} day streak — two milestones in one check-in.`
              : streakReason
                ? `${event.currentStreak} days of showing up. The chain is alive.`
                : `${event.lifetimeXp} lifetime XP moved you into a new level.`}
          </DialogDescription>
          <div className="grid grid-cols-2 gap-3 py-2">
            <div className="rounded-2xl bg-warning/10 p-4">
              <p className="text-2xl font-semibold text-foreground">{event.value} minutes</p>
              <p className="text-xs text-muted-foreground">logged today</p>
            </div>
            <div className="rounded-2xl bg-primary/10 p-4">
              <p className="text-2xl font-semibold text-foreground">{event.lifetimeXp} XP</p>
              <p className="text-xs text-muted-foreground">lifetime score</p>
            </div>
          </div>
          <Button ref={continueButtonRef} size="lg" onClick={onDismiss} className="w-full">
            Continue
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default HabitCelebrationOverlay;
