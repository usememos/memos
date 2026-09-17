# Habits Momentum Design

**Date:** 2026-09-16
**Status:** Approved for implementation

## Product intent

Add a private, account-scoped habits area to Memos that makes consistency visible and rewarding. The first release is deliberately narrow: daily habits with a measurable check-in, a small minimum that preserves the chain, a separate performance target, and durable progress across devices.

The page should answer three questions immediately:

1. Did I show up today?
2. Is my consistency improving?
3. What is the smallest useful action I can take now?

## Experience

`/habits` opens a focused dashboard. A user can create a habit with:

- a title, such as `Reading`;
- an identity statement, such as `Become a reader`;
- a habit-stack cue, such as `After morning coffee, I will read`;
- an environment cue, such as `Keep the book on the coffee table`;
- a minimum value, defaulting to 2 minutes;
- a performance target, defaulting to 20 minutes;
- a start date in the user's local calendar.

For the selected habit, the user records today's minutes. Meeting the minimum marks the day successful and awards 10 XP once. Meeting the target is reported separately, so a small action protects consistency without pretending it equals a full performance day.

The dashboard shows current and best streaks, consistency, target completion, total minutes, lifetime XP, level progress, a 14-day performance chart, and the recent chain. A missed day resets only the current streak; it never removes XP or accumulated minutes. If yesterday was missed, the UI emphasizes recovery with a `Never miss twice` message.

## Domain rules

- Cadence is daily in v1.
- Units are minutes in v1; values are non-negative integers.
- A successful day has `value >= minimum_value`.
- A target day has `value >= target_value`.
- XP is computed, not stored: `successful_days * 10`.
- Level is computed: `1 + floor(xp / 100)`.
- A day has at most one log. Re-recording replaces its value and cannot duplicate XP.
- The current calendar day is considered open until it has a log. An open today does not break an otherwise active streak.
- Consistency and target completion use elapsed scheduled days from `start_date` through `as_of_date`; an open, unlogged `as_of_date` is excluded. Earlier missing days count as misses.
- Current streak walks backward from today when today is successful, otherwise from yesterday when today is open. An explicit miss today or any earlier miss ends the chain.
- Best streak is the longest run of successful scheduled days.
- `needs_recovery` is true when the last completed scheduled day was unsuccessful.
- Habit records are owner-only. Requests for another user's habit return not found.

## Storage

Two tables are added for SQLite, MySQL, and PostgreSQL:

- `habit`: ownership, display configuration, thresholds, start date, timestamps.
- `habit_log`: one measured value per habit and local calendar date, deleted with its habit.

Dates use `YYYY-MM-DD` strings because streak boundaries belong to the user's local calendar, not server UTC. The API validates dates strictly.

## API

Add an authenticated `HabitService`:

- `CreateHabit`
- `ListHabits`
- `GetHabit`
- `UpdateHabit`
- `DeleteHabit`
- `UpsertHabitLog`
- `DeleteHabitLog`
- `GetHabitSummary`

The summary accepts an `as_of_date` and returns computed metrics plus a bounded recent daily series. No habit endpoint is added to the public ACL allow-list.

## Frontend architecture

- React Query hooks own server data and mutation invalidation.
- `/habits` is protected by the existing authenticated/full-initialization route boundary.
- The app navigation gets a Habits entry with a flame icon.
- The page uses existing buttons, inputs, dialogs, and Tailwind tokens. The visual identity is a dark ink surface with amber momentum accents and violet secondary progress, matching the approved mockup without introducing a chart dependency.
- The chart is accessible HTML/CSS: each bar has a textual label and value, and summary values remain available outside the visual.
- Empty state leads directly into habit creation.

## Deliberate exclusions

Reminders, notifications, weekly schedules, social leaderboards, penalties, streak freezes, achievements beyond levels, and non-minute units are excluded from v1. They can be layered onto the same log model after the daily loop is proven useful.

## Verification

- Unit-test summary calculations around open today, misses, duplicate log replacement, target/minimum separation, recovery, and best streak.
- Store tests cover ownership and upsert uniqueness where the local SQLite harness permits.
- Service tests cover validation and owner isolation.
- Frontend tests cover the calculation presentation and mutation loop.
- Run proto lint/generation, targeted Go tests, frontend lint/test/build, and `git diff --check`.
