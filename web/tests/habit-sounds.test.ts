import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const resume = vi.fn().mockResolvedValue(undefined);
const start = vi.fn();
const stop = vi.fn();
const connect = vi.fn();
const addEventListener = vi.fn();
const setValueAtTime = vi.fn();
const exponentialRampToValueAtTime = vi.fn();
const play = vi.fn().mockResolvedValue(undefined);
const pause = vi.fn();

class FakeAudioContext {
  currentTime = 0;
  state: AudioContextState = "suspended";
  destination = {} as AudioDestinationNode;
  resume = resume;
  createOscillator = () =>
    ({ frequency: { setValueAtTime }, connect, start, stop, addEventListener, type: "sine" }) as unknown as OscillatorNode;
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
    expect(start).toHaveBeenCalledTimes(5);
    expect(play).not.toHaveBeenCalled();
  });

  it("uses the retained OGG for major and stops active sound", async () => {
    const { playHabitSound, stopHabitSounds } = await import("@/components/Habits/habitSounds");
    await playHabitSound("major");
    expect(play).toHaveBeenCalledOnce();
    stopHabitSounds();
    expect(pause).toHaveBeenCalledOnce();
  });

  it("falls back to the target flourish when milestone playback is blocked", async () => {
    play.mockRejectedValueOnce(new Error("blocked"));
    const { playHabitSound } = await import("@/components/Habits/habitSounds");
    await expect(playHabitSound("major")).resolves.toBeUndefined();
    expect(start).toHaveBeenCalledTimes(3);
  });
});
