# Habits Festival Fireworks Design

**Date:** 2026-09-17

**Status:** Approved visual direction; ready for implementation planning

**Scope:** Frontend-only celebration and sound layer for the existing Habits/Momentum feature

## Context

The current Habits page already treats consistency as a game: it calculates streaks, target days, XP, levels, and performance percentages. This change makes earned progress feel noticeably rewarding without turning the page into a gambling product.

The approved direction is **Festival Fireworks**: colorful, emoji-rich, exaggerated celebration at the moment a result is earned. Slot-machine techniques are limited to presentation ideas such as anticipation, reveal, layered sound, and a strong payoff. The product will not use fake near-misses, loss-chasing language, random rewards, coercive countdowns, or punishment for muting effects.

This specification extends the existing Habits/Momentum design. It does not change how habits, logs, streaks, XP, or levels are calculated.

## Goals

- Make a newly earned minimum, target, streak milestone, or level feel satisfying.
- Put extra emphasis on measurable performance: minutes, streak, XP, level, and target completion.
- Use one orchestrated celebration at save time rather than constant visual noise.
- Keep the dashboard useful, readable, and compatible with light and dark themes.
- Let users mute all habit sounds with one obvious, persistent control.
- Respect reduced-motion preferences and assistive technology.
- Reuse the user's supplied audio pack for one major reward sound, retain its provenance, and remove the temporary pack after verification.

## Non-goals

- No backend, protobuf, database, scoring, or migration changes.
- No random or variable rewards.
- No points shop, currency, loot boxes, wagering, penalties, leaderboards, social comparison, or streak insurance.
- No ambient music, looping sound, background animation, remote audio fetch, analytics, or tracking.
- No third-party animation, confetti, chart, or audio dependency.
- No replay button for reward effects in this iteration.

## Experience principles

1. **Earned, not ambient.** The page remains calm until a successful first check-in is saved.
2. **Performance is explicit.** Celebration copy names the earned result and shows concrete numbers.
3. **Intensity matches achievement.** Protecting a streak is pleasant; hitting a target is bigger; a milestone or level-up is spectacular.
4. **One save, one outcome.** A successful save can produce at most one celebration tier.
5. **Corrections are neutral.** Updating or undoing an existing entry changes the numbers without replaying a reward.
6. **Failure is information.** Below-minimum values and save errors stay quiet and neutral.

## Visual direction: Festival Fireworks

The signature moment is an earned celebration overlay built from lightweight React elements and CSS:

- warm orange and yellow for fire, momentum, and target performance;
- purple and the existing primary color for supporting sparks and confetti;
- oversized emoji such as `🔥`, `✨`, `🎉`, `🏆`, and `🚀` used selectively by tier;
- expanding rings, short spark trails, and rectangular confetti pieces;
- a prominent numeric result card showing the saved minutes and the strongest newly earned metric;
- crisp, playful copy rather than casino terminology.

Colors must derive from existing semantic theme tokens so the result works in light and dark modes. The current uncommitted theme-token conversions in `HabitFormDialog`, `HabitMomentumChart`, `HabitMomentumDashboard`, and `Habits` are user work and must be preserved.

The normal dashboard does not become a permanent particle field. Existing charts, metric cards, habit guidance, and the chain remain visually stable. Small decorative accents may enrich the header and progress surfaces, but the overlay is the single signature spectacle.

## Reward classification

Celebrations happen only after the server confirms a **first log for the current day**. The classifier compares the summary immediately before the save with the freshly refetched summary after the save.

An existing log is an edit even if its prior value was below the minimum. Edits never celebrate. Undo never celebrates.

The classifier applies this precedence, returning one tier only:

| Tier | Qualification | Visual | Sound |
| --- | --- | --- | --- |
| `major` | The save increases the level, or the resulting current streak is exactly 7, 14, 30, or a positive multiple of 50 days | Full-screen fireworks layer, emoji burst, large result panel, XP/level or streak callout | Bundled milestone OGG fanfare |
| `target` | No major reward, and saved value is at least the target | Confetti burst, target badge, saved minutes, XP result | Procedural musical flourish |
| `minimum` | No higher reward, and saved value is at least the minimum | Compact spark burst near the result card, streak-protected copy, saved minutes | Short soft procedural tone |
| `none` | Saved value is below minimum, the operation is an edit/undo, or the request fails | No particles or reward panel | Silent |

When minimum and target are equal, a qualifying save receives the `target` tier. When a save earns both a streak milestone and a new level, the single major panel shows both facts rather than playing two sequences.

The existing successful-save toast is replaced by the celebration outcome. A below-minimum first save may retain a plain confirmation toast such as `Today's value saved`, but it must not use celebratory styling or sound. Save errors keep the existing error toast and never trigger effects.

## Exact interaction behavior

### Minimum tier

- Begins after the save and refreshed summary succeed.
- Runs for 900 ms.
- Shows a compact, non-modal burst that does not block pointer input.
- Announces `Streak protected. [value] minutes logged.`
- Dismisses automatically; Escape may dismiss it early.

### Target tier

- Begins after the save and refreshed summary succeed.
- Runs for 1,800 ms.
- Shows one confetti burst and a centered, non-modal result card.
- Names the target, saved minutes, and the earned `+10 XP`.
- Dismisses automatically; Escape and a visible close button dismiss it early.

### Major tier

- Begins after the save and refreshed summary succeed.
- Uses a 2,400 ms entrance/fireworks sequence, then leaves the result panel visible.
- The result panel is modal while visible, traps focus, has a visible `Continue` button, and closes with Escape.
- Names the level-up and/or exact streak milestone, saved minutes, and lifetime XP.
- Does not auto-dismiss, so the achievement is not lost before it can be read.

Only the active major panel blocks interaction. Particle layers use `pointer-events: none`.

## Sound design

### Everyday cues

The minimum and target tiers use the Web Audio API to synthesize short tones. This avoids extra files for routine actions:

- minimum: a soft, short two-note upward cue;
- target: a brighter three-note flourish with a restrained final chord;
- maximum duration is under one second;
- output gain is conservative and fades cleanly to prevent clicks.

The audio context is created or resumed from the user's save gesture. Failure to create, resume, or play audio is non-fatal; the visual result still runs and no error toast is shown.

### Major milestone asset

Use `Audio/confirmation_002.ogg` from the temporary pack and copy it to:

`web/public/audio/habits/milestone-confirmation.ogg`

The file set matches Kenney's **Interface Sounds** pack. Add `web/public/audio/habits/KENNEY-CC0.txt` with the pack title, creator, source URL, and Creative Commons Zero (CC0) license information. Credit is optional under CC0 but provenance must remain in the repository.

The entire root `Audio/` folder is temporary. Delete it only after all of the following are true:

1. the selected OGG exists at its final path;
2. the provenance/license note exists;
3. the production build includes the asset;
4. browser verification confirms the milestone sound loads and plays;
5. no code references the temporary path.

### Sound preference

- Add a visible sound toggle in the Habits page header using existing button primitives.
- The accessible label is `Mute habit sounds` when enabled and `Unmute habit sounds` when muted.
- Sound is enabled by default.
- Persist the preference in local storage under a Habits-specific, versioned key.
- The preference is local to the browser and applies to every habit.
- Muting stops future cues immediately; it does not alter visuals or scoring.
- No sound plays during initial render, navigation, habit selection, edits, undo, below-minimum saves, errors, or page reload.

## Component architecture

Keep business classification independent from rendering and audio:

```text
Habits page
  ├─ owns sound preference
  ├─ saves log and refetches authoritative summary
  └─ sends before + after + entry facts to classifier
           │
           ▼
  classifyHabitReward (pure)
           │
           ▼
  celebration state: none | minimum | target | major
           ├─ HabitCelebrationOverlay
           └─ habitSounds
```

Expected frontend additions:

- `web/src/components/Habits/habitCelebration.ts`: reward types and pure classifier;
- `web/src/components/Habits/HabitCelebrationOverlay.tsx`: tier-aware presentation, focus behavior, dismissal, and live announcement;
- `web/src/components/Habits/habitSounds.ts`: lazy Web Audio cues and milestone OGG playback;
- focused unit/component tests beside these files, following repository conventions.

`Habits.tsx` remains the orchestration boundary because it owns the mutation and summary query. `HabitMomentumDashboard` reports the user's submitted value and whether today already had a record; it does not infer a reward before persistence succeeds.

The log callback returns the freshly refetched authoritative summary. If refetch succeeds without summary data, the save remains successful but no celebration plays. This avoids displaying a reward based on guessed server state.

## State and data flow

1. User presses `Log it`.
2. Capture the current summary, submitted value, and whether today's log was already recorded.
3. Persist the log through the existing mutation.
4. Refetch the selected habit summary for the same local date.
5. If the mutation fails, show the existing save error and do not celebrate. If the mutation succeeds but the authoritative refetch fails, show `Progress saved, but the latest score could not be loaded`, keep the submitted value intact, and do not celebrate.
6. If today was already recorded, update the UI and finish with no reward.
7. Otherwise pass the before/after summaries and thresholds to the pure classifier.
8. Store the returned celebration event in ephemeral component state.
9. Render the appropriate visual and, if sound is enabled, play its cue once.
10. Clear the event on dismissal; navigation or habit selection also clears it.

The classifier is deterministic. It contains no random values, timestamps, network calls, browser storage, or audio calls.

## Accessibility and motion

- Use one `aria-live="polite"` announcement for minimum and target outcomes.
- The major result uses an accessible dialog with a labelled title and description; avoid duplicating it in the live region.
- Decorative emoji, sparks, and confetti are hidden from assistive technology.
- Never communicate a result through color, animation, or sound alone.
- Close controls and the sound toggle are keyboard accessible and have visible focus styles.
- Escape dismisses any active celebration.
- With `prefers-reduced-motion: reduce`, do not launch moving particles, expanding rings, shaking, or scaling sequences. Show a static decorated result card for the same duration/dismissal rules.
- Reduced motion does not automatically mute sound; the explicit sound preference controls audio independently.
- High-intensity flashes are forbidden. Opacity changes must not create rapid flashing.

## Responsive behavior

- Particle effects are clipped to the viewport and never create scrolling.
- On narrow screens, the result card uses safe horizontal margins and keeps the primary button above the fold.
- The sound toggle stays available in the page header without crowding the `New habit` action; labels may collapse to an icon with an accessible name.
- Confetti density is reduced on small screens to protect readability and performance.
- Celebration layers must not change the dashboard's document geometry.

## Error handling and cleanup

- A rejected save or failed authoritative refetch produces no celebration or sound.
- If Web Audio is unavailable or blocked, continue silently.
- If the milestone OGG cannot load, fall back to the target procedural flourish when possible; otherwise continue silently.
- Audio errors are not user-facing application errors and are not sent to remote services.
- Starting another valid celebration first clears any stale timers, audio nodes, and overlay state.
- Unmounting the page clears timers and stops active audio created by the feature.

## Testing and verification

### Pure classifier tests

- below minimum returns `none`;
- minimum returns `minimum`;
- target returns `target`;
- equal minimum and target returns `target`;
- level increase returns `major`;
- streaks 7, 14, 30, 50, and 100 return `major`;
- streak 49 does not return `major` solely for streak;
- combined level and streak milestone returns one `major` event containing both facts;
- any existing today record returns `none`, including an edit from below minimum to target;
- failed or missing after-summary data never yields a reward.

### Component and integration tests

- each tier renders its required copy and numeric result;
- minimum and target auto-dismiss on schedule;
- major remains until Continue, close, or Escape;
- major dialog focus enters, stays within, and returns to the initiating control;
- decorative elements are hidden from assistive technology;
- reduced-motion mode renders the static alternative;
- mute suppresses all audio calls and survives a remount;
- sound-enabled minimum, target, and major invoke the correct cue once;
- first save celebrates only after both mutation and summary refresh succeed;
- edit, undo, below-minimum save, mutation error, and refetch error are quiet;
- selecting another habit or leaving the page clears the overlay.

### Repository checks

- run focused Vitest tests while iterating;
- run frontend type checking and Biome lint through the repository's frontend lint command;
- run the full frontend unit suite;
- run the production frontend build;
- run `git diff --check`;
- verify in a browser in light and dark themes, desktop and mobile widths, keyboard-only operation, reduced-motion mode, and with sound enabled/muted;
- reload the page to verify the mute preference persists;
- trigger a major milestone in a controlled test state to verify the bundled OGG is served and audible;
- confirm the final tree contains the retained asset and CC0 note but not the temporary root `Audio/` pack.

## Acceptance criteria

The feature is ready when:

1. A first successful daily log produces exactly one reward at the correct tier after authoritative persistence.
2. A minimum save feels positive but materially quieter than a target save.
3. A target save produces the approved Festival Fireworks confetti moment and names minutes plus XP.
4. A level-up or configured streak milestone produces the full major sequence and a readable, dismissible result dialog.
5. Edits, undo, below-minimum values, failures, navigation, and reloads never replay a reward.
6. Sound is enabled by default, can be muted visibly, and the preference survives reload.
7. Missing or blocked audio never prevents saving or visual feedback.
8. Reduced-motion users receive a static equivalent with the same information.
9. The experience works with keyboard and assistive technology and does not flash rapidly.
10. Existing Habits behavior and the user's theme-token edits remain intact.
11. No backend/API/storage contract changes are introduced.
12. The retained Kenney sound has repository provenance, plays from its final path, and the temporary `Audio/` folder is removed only after verification.

## Source

- Kenney, **Interface Sounds**: <https://kenney.nl/assets/interface-sounds> (CC0)
