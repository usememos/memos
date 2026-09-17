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

export const playHabitSound = async (tier: HabitRewardTier): Promise<void> => {
  try {
    stopHabitSounds();
    if (tier === "minimum") return playNotes([523.25, 659.25], 0.1, 0.22);
    if (tier === "target") return playNotes([523.25, 659.25, 783.99], 0.12, 0.42);

    milestoneAudio = new Audio(MILESTONE_SOUND);
    milestoneAudio.volume = 0.55;
    await milestoneAudio.play();
  } catch {
    if (tier === "major") playNotes([523.25, 659.25, 783.99], 0.12, 0.42);
  }
};
