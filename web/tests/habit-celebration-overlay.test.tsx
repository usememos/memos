import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
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
    const announcement = screen.getByRole("status");
    expect(announcement).toHaveClass("sr-only");
    expect(announcement).toHaveTextContent("Target crushed. 24 minutes logged. 10 XP earned.");
    expect(container.querySelectorAll('[aria-hidden="true"][data-particle]').length).toBeGreaterThan(0);
  });

  it("does not leave an infinite trophy animation running in the major dialog", () => {
    render(<HabitCelebrationOverlay event={event("major")} onDismiss={vi.fn()} />);
    expect(document.querySelector("[data-major-emblem]")).not.toHaveClass("motion-safe:animate-bounce");
  });

  it("dismisses a non-modal celebration with Escape", () => {
    const onDismiss = vi.fn();
    render(<HabitCelebrationOverlay event={event("target")} onDismiss={onDismiss} />);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it("keeps static result content when motion is reduced", () => {
    const { container } = render(<HabitCelebrationOverlay event={event("target")} onDismiss={vi.fn()} />);
    expect(screen.getByText("24 minutes")).toBeInTheDocument();
    expect(container.querySelector("[data-motion-layer]")).toHaveClass("motion-reduce:hidden");
  });

  it("moves focus into and back out of the major dialog", async () => {
    const trigger = document.createElement("button");
    trigger.textContent = "Log it";
    document.body.append(trigger);
    trigger.focus();

    const Harness = () => {
      const [activeEvent, setActiveEvent] = useState<HabitCelebrationEvent | null>(event("major"));
      return <HabitCelebrationOverlay event={activeEvent} onDismiss={() => setActiveEvent(null)} returnFocus={() => trigger} />;
    };
    render(<Harness />);
    const continueButton = screen.getByRole("button", { name: /continue/i });
    await waitFor(() => expect(continueButton).toHaveFocus());
    fireEvent.click(continueButton);
    await waitFor(() => expect(trigger).toHaveFocus());
    trigger.remove();
  });
});
