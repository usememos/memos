import { create } from "@bufbuild/protobuf";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Habits from "@/pages/Habits";
import { HabitSchema, HabitSummarySchema } from "@/types/proto/api/v1/habit_service_pb";

const state = vi.hoisted(() => ({ habits: [] as unknown[], summary: undefined as unknown }));
const mocks = vi.hoisted(() => ({
  saveLog: vi.fn(),
  refetchSummary: vi.fn(),
  deleteLog: vi.fn(),
  createHabit: vi.fn(),
  updateHabit: vi.fn(),
  deleteHabit: vi.fn(),
  prepareHabitAudio: vi.fn(),
  playHabitSound: vi.fn(),
  stopHabitSounds: vi.fn(),
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }),
}));

vi.mock("@/hooks/useHabits", () => ({
  useHabits: () => ({ data: state.habits, isLoading: false, isError: false, refetch: vi.fn() }),
  useHabitSummary: () => ({
    data: state.summary,
    isLoading: false,
    isError: false,
    refetch: mocks.refetchSummary,
  }),
  useCreateHabit: () => ({ mutateAsync: mocks.createHabit, isPending: false }),
  useUpdateHabit: () => ({ mutateAsync: mocks.updateHabit, isPending: false }),
  useUpsertHabitLog: () => ({ mutateAsync: mocks.saveLog, isPending: false }),
  useDeleteHabitLog: () => ({ mutateAsync: mocks.deleteLog, isPending: false }),
  useDeleteHabit: () => ({ mutateAsync: mocks.deleteHabit, isPending: false }),
}));

vi.mock("@/components/Habits/HabitFormDialog", () => ({ default: () => null }));
vi.mock("@/components/Habits/HabitCelebrationOverlay", () => ({
  default: ({ event }: { event: { tier: string } | null }) => (event ? <div data-testid="celebration">{event.tier}</div> : null),
}));
vi.mock("@/components/Habits/habitSounds", () => ({
  prepareHabitAudio: mocks.prepareHabitAudio,
  playHabitSound: mocks.playHabitSound,
  stopHabitSounds: mocks.stopHabitSounds,
}));
vi.mock("react-hot-toast", () => ({ default: mocks.toast, toast: mocks.toast }));

const date = new Date().toLocaleDateString("en-CA");

const makeHabit = () =>
  create(HabitSchema, {
    name: "habits/reading",
    title: "Reading",
    identity: "Become a reader",
    cue: "After coffee, I will read",
    environment: "Keep the book on the table",
    minimumValue: 2,
    targetValue: 20,
    startDate: "2026-09-01",
  });

const makeSummary = ({ recorded, value, xp, streak }: { recorded: boolean; value: number; xp: number; streak: number }) =>
  create(HabitSummarySchema, {
    habit: makeHabit(),
    currentStreak: streak,
    bestStreak: streak,
    successfulDays: xp / 10,
    targetDays: value >= 20 ? 1 : 0,
    trackedDays: 10,
    totalValue: BigInt(value),
    consistencyPercent: 80,
    targetPercent: 50,
    xp,
    level: 1,
    levelProgressXp: xp,
    recentDays: [{ date, value, recorded, successful: value >= 2, targetMet: value >= 20 }],
  });

const renderPage = async () => {
  const rendered = render(<Habits />);
  await screen.findByRole("button", { name: /log it|update/i });
  return rendered;
};

describe("Habits celebration flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    const habit = makeHabit();
    state.habits = [habit];
    state.summary = makeSummary({ recorded: false, value: 0, xp: 80, streak: 4 });
    mocks.saveLog.mockResolvedValue(undefined);
    mocks.refetchSummary.mockResolvedValue({ data: makeSummary({ recorded: true, value: 20, xp: 90, streak: 5 }) });
    mocks.prepareHabitAudio.mockResolvedValue(undefined);
    mocks.playHabitSound.mockResolvedValue(undefined);
  });

  it("celebrates a first target save only after mutation and authoritative refetch", async () => {
    await renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Log it" }));

    await waitFor(() => expect(screen.getByTestId("celebration")).toHaveTextContent("target"));
    expect(mocks.prepareHabitAudio).toHaveBeenCalledOnce();
    expect(mocks.saveLog).toHaveBeenCalledWith({ parent: "habits/reading", logDate: date, value: 20 });
    expect(mocks.refetchSummary).toHaveBeenCalledOnce();
    expect(mocks.playHabitSound).toHaveBeenCalledWith("target");
  });

  it("keeps edits quiet even when the recorded value meets the target", async () => {
    state.summary = makeSummary({ recorded: true, value: 2, xp: 90, streak: 5 });
    mocks.refetchSummary.mockResolvedValue({ data: makeSummary({ recorded: true, value: 20, xp: 90, streak: 5 }) });
    await renderPage();
    fireEvent.change(screen.getByLabelText("Minutes today"), { target: { value: "20" } });
    fireEvent.click(screen.getByRole("button", { name: "Update" }));

    await waitFor(() => expect(mocks.refetchSummary).toHaveBeenCalledOnce());
    expect(screen.queryByTestId("celebration")).not.toBeInTheDocument();
    expect(mocks.playHabitSound).not.toHaveBeenCalled();
  });

  it("keeps a first below-minimum save quiet", async () => {
    mocks.refetchSummary.mockResolvedValue({ data: makeSummary({ recorded: true, value: 1, xp: 80, streak: 0 }) });
    await renderPage();
    fireEvent.change(screen.getByLabelText("Minutes today"), { target: { value: "1" } });
    fireEvent.click(screen.getByRole("button", { name: "Log it" }));

    await waitFor(() => expect(mocks.refetchSummary).toHaveBeenCalledOnce());
    expect(screen.queryByTestId("celebration")).not.toBeInTheDocument();
    expect(mocks.playHabitSound).not.toHaveBeenCalled();
  });

  it("does not refetch or celebrate after a rejected mutation", async () => {
    mocks.saveLog.mockRejectedValue(new Error("offline"));
    await renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Log it" }));

    await waitFor(() => expect(mocks.toast.error).toHaveBeenCalledWith("Could not save today's progress"));
    expect(mocks.refetchSummary).not.toHaveBeenCalled();
    expect(screen.queryByTestId("celebration")).not.toBeInTheDocument();
  });

  it("reports an authoritative refresh failure without celebrating", async () => {
    mocks.refetchSummary.mockRejectedValue(new Error("offline"));
    await renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Log it" }));

    await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith("Progress saved, but the latest score could not be loaded"));
    expect(screen.queryByTestId("celebration")).not.toBeInTheDocument();
    expect(mocks.playHabitSound).not.toHaveBeenCalled();
  });

  it("mutes future sounds and persists that preference", async () => {
    const firstRender = await renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Mute habit sounds" }));
    expect(window.localStorage.getItem("memos.habits.sound-enabled.v1")).toBe("false");
    expect(mocks.stopHabitSounds).toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Log it" }));
    await waitFor(() => expect(screen.getByTestId("celebration")).toHaveTextContent("target"));
    expect(mocks.playHabitSound).not.toHaveBeenCalled();

    firstRender.unmount();
    render(<Habits />);
    expect(await screen.findByRole("button", { name: "Unmute habit sounds" })).toBeInTheDocument();
  });
});
