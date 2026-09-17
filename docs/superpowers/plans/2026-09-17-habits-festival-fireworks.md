# Habits Festival Fireworks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add authoritative, tiered Festival Fireworks celebrations and optional sound to successful first-time daily habit check-ins.

**Architecture:** Keep reward classification as a pure function over the before/after habit summaries, then feed one ephemeral event into an accessible overlay and a separate sound module. `Habits.tsx` remains the orchestration boundary: it prepares audio from the user gesture, persists the log, refetches the authoritative summary, classifies the result, and owns the persisted mute preference.

**Tech Stack:** React 19, TypeScript, Tailwind CSS v4, Base UI dialog primitives, React Query v5, Web Audio API, HTMLAudioElement, Vitest, Testing Library.

**Spec:** `docs/superpowers/specs/2026-09-17-habits-festival-fireworks-design.md`

## Global Constraints

- Work only in `C:\Users\vlesp\Projects\memosCustom\.worktrees\habits-momentum` on `codex/habits-momentum`.
- Preserve the user's existing uncommitted theme-token edits in the four Habits frontend files.
- Do not touch `local-data/`.
- Do not change backend, protobuf, database, XP, level, streak, or target rules.
- Add no third-party dependency.
- Use theme tokens; support light and dark themes.
- No random rewards, fake near-misses, loss-chasing, coercive countdowns, flashing, remote audio, or analytics.
- Only a first log for the current day can celebrate; edits, undo, below-minimum saves, failures, navigation, and reloads are quiet.
- Minimum auto-dismisses after 900 ms; target after 1,800 ms; major runs a 2,400 ms entrance and remains until dismissed.
- Major streaks are exactly 7, 14, 30, and every positive multiple of 50.
- Sound defaults on and persists under `memos.habits.sound-enabled.v1`.
- Reduced motion removes moving particles, rings, shake, and scale while preserving the information and sound preference.
- Keep `Audio/` until the retained OGG, provenance note, production build, and browser playback have all been verified.
- Each task stages and commits only the files named in that task; never stage `local-data/` or unrelated user changes.

## File structure

| File | Responsibility |
| --- | --- |
| `web/src/components/Habits/habitCelebration.ts` | Pure reward types, milestone predicate, and deterministic classifier. |
| `web/src/components/Habits/habitSounds.ts` | Lazy audio preparation, procedural cues, milestone OGG playback, and cleanup. |
| `web/src/components/Habits/HabitCelebrationOverlay.tsx` | Tier-aware visuals, timers, reduced-motion CSS, live announcement, and major dialog. |
| `web/src/pages/Habits.tsx` | Save/refetch/classify orchestration, mute preference, sound trigger, overlay ownership. |
| `web/src/components/Habits/HabitMomentumDashboard.tsx` | Submit value only; remove optimistic celebration toast and retain save-error handling. |
| `web/public/audio/habits/milestone-confirmation.ogg` | Retained major milestone cue. |
| `web/public/audio/habits/KENNEY-CC0.txt` | Asset source and CC0 provenance. |
| `web/tests/habit-celebration.test.ts` | Pure classifier coverage. |
| `web/tests/habit-sounds.test.ts` | Audio preparation, tier selection, mute-independent player behavior, and cleanup. |
| `web/tests/habit-celebration-overlay.test.tsx` | Presentation, dismissal, dialog, and reduced-motion behavior. |
| `web/tests/habits-celebration-flow.test.tsx` | Save/refetch/classify integration and sound preference behavior. |
| `web/tests/habit-momentum-dashboard.test.tsx` | Existing dashboard contract adjusted to neutral save behavior. |

---

### Task 1: Deterministic reward classifier

**Files:**
- Create: `web/src/components/Habits/habitCelebration.ts`
- Create: `web/tests/habit-celebration.test.ts`

**Interfaces:**
- Consumes: generated `HabitSummary` from `@/types/proto/api/v1/habit_service_pb`.
- Produces: `HabitCelebrationEvent`, `HabitRewardTier`, `classifyHabitReward(input)`, and `isMajorHabitStreak(streak)`.

- [ ] **Step 1: Write the classifier tests**

Create `web/tests/habit-celebration.test.ts` with a summary factory and table-driven tier coverage:

```ts
import { create } from "@bufbuild/protobuf";
import { describe, expect, it } from "vitest";
import { classifyHabitReward, isMajorHabitStreak } from "@/components/Habits/habitCelebration";
import { HabitSchema, HabitSummarySchema } from "@/types/proto/api/v1/habit_service_pb";

const makeSummary = (overrides: { currentStreak?: number; xp?: number; level?: number } = {}) =>
  create(HabitSummarySchema, {
    habit: create(HabitSchema, {
      name: "habits/reading",
      title: "Reading",
      minimumValue: 2,
      targetValue: 20,
      startDate: "2026-09-01",
    }),
    currentStreak: overrides.currentStreak ?? 6,
    xp: overrides.xp ?? 80,
    level: overrides.level ?? 1,
  });

describe("classifyHabitReward", () => {
  it("keeps below-minimum first logs quiet", () => {
    expect(classifyHabitReward({ before: makeSummary(), after: makeSummary(), value: 1, wasRecorded: false })).toBeNull();
  });

  it("returns minimum and target tiers from authoritative summaries", () => {
    expect(classifyHabitReward({ before: makeSummary(), after: makeSummary({ xp: 90 }), value: 2, wasRecorded: false })?.tier).toBe(
      "minimum",
    );
    expect(classifyHabitReward({ before: makeSummary(), after: makeSummary({ xp: 90 }), value: 20, wasRecorded: false })?.tier).toBe(
      "target",
    );
  });

  it("gives target precedence when minimum equals target", () => {
    const before = makeSummary();
    before.habit!.minimumValue = 20;
    expect(classifyHabitReward({ before, after: makeSummary({ xp: 90 }), value: 20, wasRecorded: false })?.tier).toBe("target");
  });

  it("uses the major tier for a level increase", () => {
    expect(
      classifyHabitReward({
        before: makeSummary({ xp: 90, level: 1 }),
        after: makeSummary({ xp: 100, level: 2 }),
        value: 20,
        wasRecorded: false,
      })?.tier,
    ).toBe("major");
  });

  it("uses the major tier for a configured streak milestone", () => {
    expect(
      classifyHabitReward({
        before: makeSummary({ currentStreak: 13, xp: 120, level: 2 }),
        after: makeSummary({ currentStreak: 14, xp: 130, level: 2 }),
        value: 20,
        wasRecorded: false,
      })?.tier,
    ).toBe("major");
  });

  it("returns one major event containing simultaneous level and streak reasons", () => {
    const event = classifyHabitReward({
      before: makeSummary({ currentStreak: 6, xp: 90, level: 1 }),
      after: makeSummary({ currentStreak: 7, xp: 100, level: 2 }),
      value: 24,
      wasRecorded: false,
    });
    expect(event).toMatchObject({ tier: "major", majorReasons: ["level", "streak"], level: 2, currentStreak: 7, xpAwarded: 10 });
  });

  it("never rewards edits or missing authoritative results", () => {
    expect(classifyHabitReward({ before: makeSummary(), after: makeSummary({ level: 2 }), value: 20, wasRecorded: true })).toBeNull();
    expect(classifyHabitReward({ before: makeSummary(), after: undefined, value: 20, wasRecorded: false })).toBeNull();
  });
});

describe("isMajorHabitStreak", () => {
  it.each([7, 14, 30, 50, 100])("recognizes %i days", (streak) => expect(isMajorHabitStreak(streak)).toBe(true));
  it.each([0, 6, 8, 29, 49, 51])("rejects %i days", (streak) => expect(isMajorHabitStreak(streak)).toBe(false));
});
```

- [ ] **Step 2: Run the focused test and confirm the expected red state**

Run:

```powershell
cd web
corepack pnpm vitest run tests/habit-celebration.test.ts
```

Expected: FAIL because `@/components/Habits/habitCelebration` does not exist.

- [ ] **Step 3: Implement the pure reward model**

Create `web/src/components/Habits/habitCelebration.ts` with these public types and logic:

```ts
import type { HabitSummary } from "@/types/proto/api/v1/habit_service_pb";

export type HabitRewardTier = "minimum" | "target" | "major";
export type HabitMajorReason = "level" | "streak";

export interface HabitCelebrationEvent {
  tier: HabitRewardTier;
  value: number;
  xpAwarded: number;
  lifetimeXp: number;
  level: number;
  currentStreak: number;
  minimumValue: number;
  targetValue: number;
  majorReasons: HabitMajorReason[];
}

interface ClassifyHabitRewardInput {
  before: HabitSummary;
  after: HabitSummary | undefined;
  value: number;
  wasRecorded: boolean;
}

export const isMajorHabitStreak = (streak: number) => streak === 7 || streak === 14 || streak === 30 || (streak > 0 && streak % 50 === 0);

export const classifyHabitReward = ({ before, after, value, wasRecorded }: ClassifyHabitRewardInput): HabitCelebrationEvent | null => {
  const habit = before.habit;
  if (wasRecorded || !habit || !after || value < habit.minimumValue) return null;

  const majorReasons: HabitMajorReason[] = [];
  if (after.level > before.level) majorReasons.push("level");
  if (isMajorHabitStreak(after.currentStreak)) majorReasons.push("streak");

  return {
    tier: majorReasons.length > 0 ? "major" : value >= habit.targetValue ? "target" : "minimum",
    value,
    xpAwarded: Math.max(0, after.xp - before.xp),
    lifetimeXp: after.xp,
    level: after.level,
    currentStreak: after.currentStreak,
    minimumValue: habit.minimumValue,
    targetValue: habit.targetValue,
    majorReasons,
  };
};
```

- [ ] **Step 4: Run the classifier test and frontend type check**

Run:

```powershell
cd web
corepack pnpm vitest run tests/habit-celebration.test.ts
corepack pnpm exec tsc --noEmit --skipLibCheck
```

Expected: both commands PASS.

- [ ] **Step 5: Commit the classifier**

```powershell
git add -- web/src/components/Habits/habitCelebration.ts web/tests/habit-celebration.test.ts
git commit -m "feat: classify earned habit celebrations"
```

---

### Task 2: Sound engine and retained CC0 milestone asset

**Files:**
- Create: `web/src/components/Habits/habitSounds.ts`
- Create: `web/tests/habit-sounds.test.ts`
- Create: `web/public/audio/habits/milestone-confirmation.ogg`
- Create: `web/public/audio/habits/KENNEY-CC0.txt`
- Source only: `Audio/confirmation_002.ogg`

**Interfaces:**
- Consumes: `HabitRewardTier` from Task 1.
- Produces: `prepareHabitAudio()`, `playHabitSound(tier)`, and `stopHabitSounds()`.

- [ ] **Step 1: Write sound-module tests against browser fakes**

Create `web/tests/habit-sounds.test.ts`. Stub `AudioContext` and `Audio`, import the module after stubbing, and assert these behaviors:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const resume = vi.fn().mockResolvedValue(undefined);
const close = vi.fn().mockResolvedValue(undefined);
const start = vi.fn();
const stop = vi.fn();
const connect = vi.fn();
const setValueAtTime = vi.fn();
const exponentialRampToValueAtTime = vi.fn();
const play = vi.fn().mockResolvedValue(undefined);
const pause = vi.fn();

class FakeAudioContext {
  currentTime = 0;
  state: AudioContextState = "suspended";
  destination = {} as AudioDestinationNode;
  resume = resume;
  close = close;
  createOscillator = () =>
    ({ frequency: { setValueAtTime }, connect, start, stop, addEventListener: vi.fn(), type: "sine" }) as unknown as OscillatorNode;
  createGain = () => ({ gain: { setValueAtTime, exponentialRampToValueAtTime }, connect }) as unknown as GainNode;
}

class FakeAudio {
  src = "";
  currentTime = 0;
  volume = 1;
  play = play;
  pause = pause;
  constructor(src: string) {
    this.src = src;
  }
}

describe("habitSounds", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    vi.stubGlobal("AudioContext", FakeAudioContext);
    vi.stubGlobal("Audio", FakeAudio);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("prepares audio by resuming the context from the save gesture", async () => {
    const { prepareHabitAudio } = await import("@/components/Habits/habitSounds");
    await prepareHabitAudio();
    expect(resume).toHaveBeenCalledOnce();
  });

  it("uses procedural oscillators for minimum and target", async () => {
    const { playHabitSound } = await import("@/components/Habits/habitSounds");
    await playHabitSound("minimum");
    await playHabitSound("target");
    expect(start).toHaveBeenCalled();
    expect(play).not.toHaveBeenCalled();
  });

  it("uses the retained OGG for major and stops active sound", async () => {
    const { playHabitSound, stopHabitSounds } = await import("@/components/Habits/habitSounds");
    await playHabitSound("major");
    expect(play).toHaveBeenCalledOnce();
    stopHabitSounds();
    expect(pause).toHaveBeenCalledOnce();
  });
});
```

Reset mock call counts in `beforeEach` so assertions remain independent.

- [ ] **Step 2: Run the sound test and confirm the expected red state**

Run:

```powershell
cd web
corepack pnpm vitest run tests/habit-sounds.test.ts
```

Expected: FAIL because `habitSounds.ts` does not exist.

- [ ] **Step 3: Implement lazy, failure-safe sound playback**

Create `web/src/components/Habits/habitSounds.ts` around one lazily created context and one active milestone element:

```ts
import type { HabitRewardTier } from "./habitCelebration";

const MILESTONE_SOUND = "/audio/habits/milestone-confirmation.ogg";
let context: AudioContext | undefined;
let milestoneAudio: HTMLAudioElement | undefined;
const activeOscillators = new Set<OscillatorNode>();

const getContext = () => {
  if (typeof AudioContext === "undefined") return undefined;
  context ??= new AudioContext();
  return context;
};

export const prepareHabitAudio = async (): Promise<void> => {
  try {
    const audioContext = getContext();
    if (audioContext?.state === "suspended") await audioContext.resume();
  } catch {
    // Visual rewards remain available when audio is blocked.
  }
};

const playNotes = (frequencies: number[], spacing: number, duration: number) => {
  const audioContext = getContext();
  if (!audioContext || audioContext.state === "closed") return;
  frequencies.forEach((frequency, index) => {
    const startAt = audioContext.currentTime + index * spacing;
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(frequency, startAt);
    gain.gain.setValueAtTime(0.0001, startAt);
    gain.gain.exponentialRampToValueAtTime(0.09, startAt + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    activeOscillators.add(oscillator);
    oscillator.addEventListener("ended", () => activeOscillators.delete(oscillator), { once: true });
    oscillator.start(startAt);
    oscillator.stop(startAt + duration + 0.02);
  });
};

export const playHabitSound = async (tier: HabitRewardTier): Promise<void> => {
  try {
    stopHabitSounds();
    if (tier === "minimum") return playNotes([523.25, 659.25], 0.1, 0.22);
    if (tier === "target") return playNotes([523.25, 659.25, 783.99], 0.12, 0.42);
    milestoneAudio?.pause();
    milestoneAudio = new Audio(MILESTONE_SOUND);
    milestoneAudio.volume = 0.55;
    await milestoneAudio.play();
  } catch {
    if (tier === "major") playNotes([523.25, 659.25, 783.99], 0.12, 0.42);
  }
};

export const stopHabitSounds = (): void => {
  for (const oscillator of activeOscillators) {
    try {
      oscillator.stop();
    } catch {
      // The oscillator may already have ended.
    }
  }
  activeOscillators.clear();
  milestoneAudio?.pause();
  if (milestoneAudio) milestoneAudio.currentTime = 0;
  milestoneAudio = undefined;
};
```

- [ ] **Step 4: Copy the selected asset and add provenance**

Resolve both paths and confirm the source is inside the named worktree before copying:

```powershell
$worktree = (Resolve-Path 'C:\Users\vlesp\Projects\memosCustom\.worktrees\habits-momentum').Path
$source = (Resolve-Path (Join-Path $worktree 'Audio\confirmation_002.ogg')).Path
$destinationDirectory = Join-Path $worktree 'web\public\audio\habits'
if (-not $source.StartsWith($worktree, [System.StringComparison]::OrdinalIgnoreCase)) { throw 'Audio source escaped the worktree' }
New-Item -ItemType Directory -Force -Path $destinationDirectory | Out-Null
Copy-Item -LiteralPath $source -Destination (Join-Path $destinationDirectory 'milestone-confirmation.ogg')
```

Create `web/public/audio/habits/KENNEY-CC0.txt` with:

```text
Asset: confirmation_002.ogg from Interface Sounds
Creator: Kenney
Source: https://kenney.nl/assets/interface-sounds
License: Creative Commons Zero (CC0 1.0 Universal)
License URL: https://creativecommons.org/publicdomain/zero/1.0/

The source pack permits personal, educational, and commercial use. Attribution is not required; this note is retained for provenance.
```

- [ ] **Step 5: Run sound tests and verify the copied bytes**

Run:

```powershell
cd web
corepack pnpm vitest run tests/habit-sounds.test.ts
cd ..
$sourceHash = (Get-FileHash -Algorithm SHA256 -LiteralPath 'Audio\confirmation_002.ogg').Hash
$retainedHash = (Get-FileHash -Algorithm SHA256 -LiteralPath 'web\public\audio\habits\milestone-confirmation.ogg').Hash
if ($sourceHash -ne $retainedHash) { throw 'Retained milestone sound does not match the selected source' }
```

Expected: tests PASS and the hash comparison produces no error.

- [ ] **Step 6: Commit the sound layer and retained asset**

```powershell
git add -- web/src/components/Habits/habitSounds.ts web/tests/habit-sounds.test.ts web/public/audio/habits/milestone-confirmation.ogg web/public/audio/habits/KENNEY-CC0.txt
git commit -m "feat: add habit reward sounds"
```

Do not delete `Audio/` in this task; browser playback is still unverified.

---

### Task 3: Accessible Festival Fireworks overlay

**Files:**
- Create: `web/src/components/Habits/HabitCelebrationOverlay.tsx`
- Create: `web/tests/habit-celebration-overlay.test.tsx`

**Interfaces:**
- Consumes: `HabitCelebrationEvent` from Task 1.
- Produces: default component `HabitCelebrationOverlay({ event, onDismiss, returnFocus })`.

- [ ] **Step 1: Write overlay behavior tests**

Create `web/tests/habit-celebration-overlay.test.tsx` with fake timers and these exact assertions:

```tsx
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import HabitCelebrationOverlay from "@/components/Habits/HabitCelebrationOverlay";
import type { HabitCelebrationEvent } from "@/components/Habits/habitCelebration";

const event = (tier: HabitCelebrationEvent["tier"]): HabitCelebrationEvent => ({
  tier,
  value: 24,
  xpAwarded: 10,
  lifetimeXp: 100,
  level: 2,
  currentStreak: 7,
  minimumValue: 2,
  targetValue: 20,
  majorReasons: tier === "major" ? ["level", "streak"] : [],
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("HabitCelebrationOverlay", () => {
  it.each([
    ["minimum", 900],
    ["target", 1800],
  ] as const)("auto-dismisses %s after %i ms", (tier, delay) => {
    vi.useFakeTimers();
    const onDismiss = vi.fn();
    render(<HabitCelebrationOverlay event={event(tier)} onDismiss={onDismiss} />);
    act(() => vi.advanceTimersByTime(delay - 1));
    expect(onDismiss).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it("keeps a major result open and exposes both earned facts", () => {
    vi.useFakeTimers();
    const onDismiss = vi.fn();
    render(<HabitCelebrationOverlay event={event("major")} onDismiss={onDismiss} />);
    expect(screen.getByRole("dialog", { name: /level 2 unlocked/i })).toBeInTheDocument();
    expect(screen.getByText(/7 day streak/i)).toBeInTheDocument();
    expect(screen.getByText(/24 minutes/i)).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(10000));
    expect(onDismiss).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it("uses a polite announcement and hides decorative particles", () => {
    const { container } = render(<HabitCelebrationOverlay event={event("target")} onDismiss={vi.fn()} />);
    expect(screen.getByRole("status")).toHaveTextContent("Target crushed. 24 minutes logged. 10 XP earned.");
    expect(container.querySelectorAll('[aria-hidden="true"][data-particle]').length).toBeGreaterThan(0);
  });
});
```

Add a reduced-motion assertion by inspecting that the animated particle container uses `motion-reduce:hidden` and that the static result content remains rendered.

- [ ] **Step 2: Run the overlay test and confirm the expected red state**

Run:

```powershell
cd web
corepack pnpm vitest run tests/habit-celebration-overlay.test.tsx
```

Expected: FAIL because `HabitCelebrationOverlay.tsx` does not exist.

- [ ] **Step 3: Implement tier copy, timers, particles, and the major dialog**

Create `HabitCelebrationOverlay.tsx` using existing `Dialog`, `DialogContent`, `DialogTitle`, `DialogDescription`, and `Button` primitives. The component must:

```tsx
interface Props {
  event: HabitCelebrationEvent | null;
  onDismiss: () => void;
  returnFocus?: () => HTMLElement | null;
}

const AUTO_DISMISS_MS = { minimum: 900, target: 1800 } as const;

useEffect(() => {
  if (!event || event.tier === "major") return;
  const timeout = window.setTimeout(onDismiss, AUTO_DISMISS_MS[event.tier]);
  return () => window.clearTimeout(timeout);
}, [event, onDismiss]);
```

Render minimum and target inside a fixed `pointer-events-none` layer with a result card and `role="status" aria-live="polite"`. Give their visible close button `pointer-events-auto`. Use deterministic arrays for particles rather than `Math.random()`:

```tsx
const CONFETTI = [
  { x: "8%", delay: "0ms", rotate: "18deg", color: "bg-warning" },
  { x: "18%", delay: "90ms", rotate: "-24deg", color: "bg-primary" },
  { x: "31%", delay: "30ms", rotate: "42deg", color: "bg-chart-2" },
  { x: "47%", delay: "120ms", rotate: "-12deg", color: "bg-warning" },
  { x: "63%", delay: "50ms", rotate: "33deg", color: "bg-primary" },
  { x: "79%", delay: "140ms", rotate: "-36deg", color: "bg-chart-2" },
  { x: "91%", delay: "70ms", rotate: "16deg", color: "bg-warning" },
] as const;
```

Each decorative node carries `aria-hidden="true" data-particle`, `motion-reduce:hidden`, and one of these local animation names rendered in a `<style>` element inside the component:

```css
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
```

Use `habit-confetti` for 1,800 ms on target particles and `habit-firework` for 2,400 ms on major rings/sparks. The minimum tier uses the same firework keyframe for 900 ms on no more than four sparks. Do not add global CSS or a configuration dependency.

For minimum and target, register a document `keydown` listener only while the event exists and call `onDismiss` for Escape; remove the listener in the effect cleanup. Give target a visible close button. Minimum may close through Escape or its 900 ms timer. Major Escape behavior remains owned by Base UI.

For `major`, render the decorative viewport layer plus a controlled Base UI dialog. Store a ref to the Continue button, pass it as `initialFocus`, and pass the optional `returnFocus` callback as `finalFocus` so the repository's dialog wrapper does not use its default `false` focus targets:

```tsx
<Dialog open={Boolean(event)} onOpenChange={(open) => !open && onDismiss()}>
  <DialogContent
    className="overflow-visible border-warning/40 bg-card text-center"
    showCloseButton
    initialFocus={continueButtonRef}
    finalFocus={returnFocus}
  >
    <DialogTitle>{levelReason ? `Level ${event.level} unlocked!` : `${event.currentStreak} day streak!`}</DialogTitle>
    <DialogDescription>{majorDescription}</DialogDescription>
    <Button ref={continueButtonRef} onClick={onDismiss}>Continue</Button>
  </DialogContent>
</Dialog>
```

Show both facts when both reasons exist. Allow Base UI to provide focus trapping and Escape handling; do not create a second focus manager. Add a component test that focuses an external trigger before render, supplies `returnFocus={() => trigger}`, verifies Continue receives initial focus, closes the dialog, and verifies focus returns to that trigger.

The major decorative entrance uses a single 2,400 ms animation cycle and then stops. The dialog content remains static and open after that cycle. All moving decorative layers use `motion-reduce:hidden`; a static emoji and result card remain visible under reduced motion.

- [ ] **Step 4: Run overlay tests and type checking**

Run:

```powershell
cd web
corepack pnpm vitest run tests/habit-celebration-overlay.test.tsx
corepack pnpm exec tsc --noEmit --skipLibCheck
```

Expected: both commands PASS with no `act()` warning.

- [ ] **Step 5: Commit the overlay**

```powershell
git add -- web/src/components/Habits/HabitCelebrationOverlay.tsx web/tests/habit-celebration-overlay.test.tsx
git commit -m "feat: add festival fireworks celebration overlay"
```

---

### Task 4: Authoritative save flow, mute control, and page integration

**Files:**
- Modify: `web/src/pages/Habits.tsx`
- Modify: `web/src/components/Habits/HabitMomentumDashboard.tsx`
- Modify: `web/tests/habit-momentum-dashboard.test.tsx`
- Create: `web/tests/habits-celebration-flow.test.tsx`

**Interfaces:**
- Consumes: `classifyHabitReward`, `HabitCelebrationOverlay`, `prepareHabitAudio`, `playHabitSound`, `stopHabitSounds`, and existing `useLocalStorage`.
- Produces: integrated first-save reward flow and persisted sound toggle.

- [ ] **Step 1: Update the dashboard test to require neutral submission**

In `habit-momentum-dashboard.test.tsx`, retain the measured-value assertion and add a rejected-save assertion:

```tsx
it("reports a save failure without emitting an optimistic reward", async () => {
  const onLog = vi.fn().mockRejectedValue(new Error("offline"));
  render(<HabitMomentumDashboard summary={summary} today="2026-09-16" onLog={onLog} onUndo={vi.fn()} onEdit={vi.fn()} />);
  fireEvent.click(screen.getByRole("button", { name: "Log it" }));
  expect(await screen.findByText("Could not save today's progress")).toBeInTheDocument();
  expect(screen.queryByText(/XP — you showed up/i)).not.toBeInTheDocument();
});
```

If the global toast renderer is not present in this test harness, mock `react-hot-toast` and assert `toast.error` instead. Do not weaken the assertion to a generic function call.

- [ ] **Step 2: Write the page integration tests**

Create `web/tests/habits-celebration-flow.test.tsx`. Mock `@/hooks/useHabits`, `HabitCelebrationOverlay`, and `habitSounds`, then cover:

```tsx
vi.mock("@/components/Habits/habitSounds", () => ({
  prepareHabitAudio: vi.fn().mockResolvedValue(undefined),
  playHabitSound: vi.fn().mockResolvedValue(undefined),
  stopHabitSounds: vi.fn(),
}));

vi.mock("@/components/Habits/HabitCelebrationOverlay", () => ({
  default: ({ event }: { event: { tier: string } | null }) => (event ? <div data-testid="celebration">{event.tier}</div> : null),
}));
```

Use mutable mock return values for `useHabitSummary`, `useUpsertHabitLog`, and `refetch`. Assert these flows separately:

1. first target save calls `prepareHabitAudio`, awaits the mutation and refetch, renders `target`, and calls `playHabitSound("target")` once;
2. existing recorded today saves and refetches but renders no celebration and plays no sound;
3. below-minimum first save renders no celebration and plays no sound;
4. mutation rejection renders no celebration and does not call refetch;
5. refetch rejection renders no celebration and shows `Progress saved, but the latest score could not be loaded`;
6. clicking `Mute habit sounds` stores `false`, changes the label to `Unmute habit sounds`, calls `stopHabitSounds`, and a following qualifying save does not play sound;
7. preloading local storage with `false` starts muted after a remount.

Construct summaries with explicit `habit`, `currentStreak`, `xp`, `level`, and `recentDays` fields using `create(HabitSummarySchema, fields)`. Use a first target result whose `before` summary has 80 XP at level 1 and whose `after` summary has 90 XP at level 1; use 90 to 100 XP and level 1 to 2 only when the test expects `major`.

- [ ] **Step 3: Run the two focused tests and confirm the red state**

Run:

```powershell
cd web
corepack pnpm vitest run tests/habit-momentum-dashboard.test.tsx tests/habits-celebration-flow.test.tsx
```

Expected: the new integration tests FAIL because the page does not own celebration or sound state yet.

- [ ] **Step 4: Remove optimistic reward copy from the dashboard**

Change `HabitMomentumDashboard.submit` to delegate the save and only report rejection:

```ts
const submit = async () => {
  try {
    await onLog(minutes);
  } catch {
    toast.error("Could not save today's progress");
  }
};
```

Do not change the input, saving state, `onUndo`, or the user's theme-token classes.

- [ ] **Step 5: Add page-owned preference and celebration state**

In `Habits.tsx`, add imports for `Volume2Icon`, `VolumeXIcon`, `toast`, `useLocalStorage`, the classifier, overlay, and sound functions. Add:

```ts
const HABIT_SOUND_STORAGE_KEY = "memos.habits.sound-enabled.v1";

const [soundEnabled, setSoundEnabled] = useLocalStorage(HABIT_SOUND_STORAGE_KEY, true);
const [celebration, setCelebration] = useState<HabitCelebrationEvent | null>(null);
const celebrationReturnFocusRef = useRef<HTMLElement | null>(null);

useEffect(() => {
  setCelebration(null);
  stopHabitSounds();
}, [selectedName]);

useEffect(() => () => stopHabitSounds(), []);
```

Do not call sound functions during render.

- [ ] **Step 6: Implement save, refetch, classification, and sound**

Add a page callback inside the `summary && selected` branch's available scope, or define it above render with guards:

```ts
const saveToday = async (value: number) => {
  if (!selected || !summary) return;

  const before = summary;
  const wasRecorded = Boolean(before.recentDays.find((day) => day.date === date)?.recorded);
  celebrationReturnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  if (soundEnabled) void prepareHabitAudio();

  await saveLog.mutateAsync({ parent: selected.name, logDate: date, value });

  let after;
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
```

Pass `saveToday` to `HabitMomentumDashboard.onLog`. Keep mutation rejection propagating so the dashboard reports the save error. Do not report a save error for a successful mutation followed by a failed refetch.

- [ ] **Step 7: Add the visible mute toggle and overlay**

Place a compact outline/ghost button next to `New habit`, retaining responsive wrapping:

```tsx
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
```

Render the overlay once at page level:

```tsx
<HabitCelebrationOverlay
  event={celebration}
  onDismiss={() => setCelebration(null)}
  returnFocus={() => celebrationReturnFocusRef.current}
/>
```

Ensure the empty, scheduled, loading, and error states still expose the header toggle but never trigger sound.

- [ ] **Step 8: Run focused integration, classifier, sound, and overlay tests**

Run:

```powershell
cd web
corepack pnpm vitest run tests/habit-celebration.test.ts tests/habit-sounds.test.ts tests/habit-celebration-overlay.test.tsx tests/habit-momentum-dashboard.test.tsx tests/habits-celebration-flow.test.tsx
corepack pnpm exec tsc --noEmit --skipLibCheck
```

Expected: all focused tests and type checking PASS.

- [ ] **Step 9: Commit the integrated experience**

Review the diff first to separate the user's pre-existing token edits from this feature. Stage the complete current versions of the two modified files only after confirming the feature builds on those edits:

```powershell
git diff -- web/src/pages/Habits.tsx web/src/components/Habits/HabitMomentumDashboard.tsx
git add -- web/src/pages/Habits.tsx web/src/components/Habits/HabitMomentumDashboard.tsx web/tests/habit-momentum-dashboard.test.tsx web/tests/habits-celebration-flow.test.tsx
git commit -m "feat: celebrate authoritative habit progress"
```

The commit will necessarily include the user's compatible theme-token changes in these two files. Leave `HabitFormDialog.tsx` and `HabitMomentumChart.tsx` unstaged unless implementation requires them.

---

### Task 5: Full verification, browser QA, and temporary audio cleanup

**Files:**
- Verify: all Task 1–4 files
- Delete after successful playback verification: `Audio/`
- Preserve: `local-data/`

**Interfaces:**
- Consumes: completed integrated feature.
- Produces: verified frontend and a clean retained-audio layout.

- [ ] **Step 1: Run formatter/linter, all frontend tests, and production build**

Run from the worktree root:

```powershell
cd web
corepack pnpm lint
corepack pnpm test
corepack pnpm build
cd ..
git diff --check
```

Expected: all four checks PASS. Record the Vitest test count and Vite build result for the handoff.

- [ ] **Step 2: Start or reuse the local app and verify the standard reward tiers**

Run the existing backend on `8081` and frontend on `3001` if they are not already active. In the browser, use a disposable habit or controlled local data and verify:

- first below-minimum save: neutral confirmation only, no motion, no sound;
- first minimum save: compact sparks, correct minutes/streak copy, soft two-note cue, 900 ms dismissal;
- first target save: confetti, minutes and XP, three-note flourish, 1,800 ms dismissal;
- editing the saved value: numbers update, no particles, no reward sound;
- undo: no particles or reward sound;
- failed request using an intentionally unavailable backend: save error only.

Use browser console/network inspection to confirm there are no uncaught exceptions and no requests to remote audio or analytics hosts.

- [ ] **Step 3: Verify the major experience and retained OGG**

Create a controlled state at a 6-day streak or 90 XP, then log the qualifying first check-in. Confirm:

- `/audio/habits/milestone-confirmation.ogg` returns HTTP 200;
- the OGG is audibly played once;
- the 2,400 ms fireworks entrance completes without rapid flashing;
- the dialog names the exact level and/or streak, minutes, and lifetime XP;
- focus enters the dialog, Tab stays inside it, Escape closes it, and focus returns to the initiating control;
- the dialog remains open beyond 2,400 ms until explicitly dismissed.

- [ ] **Step 4: Verify preference, themes, mobile, and reduced motion**

In the browser:

- mute, reload, and confirm the toggle remains `Unmute habit sounds` and all tiers stay silent;
- unmute and confirm the next newly earned reward plays once;
- check light and dark themes for readable contrast;
- check widths 390×844 and desktop for no horizontal scroll or clipped controls;
- enable operating-system/browser reduced motion and confirm particles/rings disappear while static result content remains;
- confirm decorative emoji and particles are absent from the accessibility tree;
- confirm the target/minimum live announcement occurs once.

- [ ] **Step 5: Remove only the verified temporary audio pack**

Resolve and validate the exact deletion target before removing it:

```powershell
$worktree = (Resolve-Path 'C:\Users\vlesp\Projects\memosCustom\.worktrees\habits-momentum').Path
$temporaryAudio = (Resolve-Path (Join-Path $worktree 'Audio')).Path
$expectedAudio = Join-Path $worktree 'Audio'
if (-not [System.StringComparer]::OrdinalIgnoreCase.Equals($temporaryAudio, $expectedAudio)) { throw 'Unexpected audio deletion target' }
if (-not (Test-Path (Join-Path $worktree 'web\public\audio\habits\milestone-confirmation.ogg'))) { throw 'Retained sound is missing' }
if (-not (Test-Path (Join-Path $worktree 'web\public\audio\habits\KENNEY-CC0.txt'))) { throw 'Provenance note is missing' }
Remove-Item -LiteralPath $temporaryAudio -Recurse -Force
if (Test-Path -LiteralPath $temporaryAudio) { throw 'Temporary audio pack was not removed' }
```

This deletion is explicitly authorized by the user and affects only the temporary untracked `Audio/` folder. It cannot be recovered from Git; the retained selected OGG remains versioned.

- [ ] **Step 6: Run final repository checks after cleanup**

Run:

```powershell
cd web
corepack pnpm lint
corepack pnpm test
corepack pnpm build
cd ..
git diff --check
git status --short --branch
```

Expected: all checks PASS; `Audio/` is absent; `local-data/` remains untouched; only intentional user-owned changes remain outside feature commits.

- [ ] **Step 7: Commit any verification-driven fixes and request code review**

If browser verification required code changes, review the diff, stage only the known feature files that changed, and commit:

```powershell
git add -- web/src/components/Habits/habitCelebration.ts web/src/components/Habits/habitSounds.ts web/src/components/Habits/HabitCelebrationOverlay.tsx web/src/components/Habits/HabitMomentumDashboard.tsx web/src/pages/Habits.tsx web/tests/habit-celebration.test.ts web/tests/habit-sounds.test.ts web/tests/habit-celebration-overlay.test.tsx web/tests/habit-momentum-dashboard.test.tsx web/tests/habits-celebration-flow.test.tsx
git commit -m "fix: polish habit celebration experience"
```

Then use `superpowers:requesting-code-review` against the complete commit range from `a30a3021` through `HEAD`. Address validated findings with `superpowers:receiving-code-review`, rerun the final checks, and only then use `superpowers:finishing-a-development-branch` to present integration options.
