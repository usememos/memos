import { useEffect, useState } from "react";

const BAR_COUNT = 40;
const IDLE_LEVEL = 0.08;
const UPDATE_MS = 33;
const CENTER_EMPHASIS = 0.35;
const BOOST_OFFSET = 0.04;
const BOOST_CURVE = 0.55;
const BOOST_GAIN = 2.8;

const createIdleLevels = (): number[] => Array.from({ length: BAR_COUNT }, () => IDLE_LEVEL);

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

function computeLevels(dataArray: Uint8Array, bufferLength: number): number[] {
  const sampled: number[] = [];
  for (let i = 0; i < BAR_COUNT; i++) {
    const start = Math.floor((i / BAR_COUNT) * bufferLength);
    const end = Math.floor(((i + 1) / BAR_COUNT) * bufferLength);
    let sum = 0;
    for (let j = start; j < end; j++) {
      sum += dataArray[j];
    }
    const span = Math.max(1, end - start);
    const avg = sum / (255 * span);
    const boosted = Math.min(1, (avg + BOOST_OFFSET) ** BOOST_CURVE * BOOST_GAIN);
    sampled.push(Math.max(IDLE_LEVEL, boosted));
  }

  const mirrored: number[] = [];
  for (let i = 0; i < BAR_COUNT; i++) {
    const j = BAR_COUNT - 1 - i;
    const v = (sampled[i] + sampled[j]) / 2;
    const centerDistance = Math.abs(i - (BAR_COUNT - 1) / 2) / (BAR_COUNT / 2);
    const envelope = 1 - centerDistance * CENTER_EMPHASIS;
    mirrored.push(Math.max(IDLE_LEVEL, clamp01(v * envelope)));
  }

  for (let i = 1; i < BAR_COUNT - 1; i++) {
    mirrored[i] = Math.max(IDLE_LEVEL, (mirrored[i - 1] + mirrored[i] * 2 + mirrored[i + 1]) / 4);
  }

  return mirrored;
}

/**
 * Derives normalized bar levels (0–1) from a microphone MediaStream for live waveform UI.
 */
export function useAudioWaveform(stream: MediaStream | null, enabled: boolean): number[] {
  const [levels, setLevels] = useState<number[]>(createIdleLevels);

  useEffect(() => {
    if (!enabled || !stream) {
      setLevels(createIdleLevels());
      return;
    }

    const audioContext = new AudioContext();
    const source = audioContext.createMediaStreamSource(stream);
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 512;
    analyser.minDecibels = -72;
    analyser.maxDecibels = -8;
    analyser.smoothingTimeConstant = 0.72;
    source.connect(analyser);

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    let rafId = 0;
    let lastEmit = 0;
    let first = true;

    const tick = (now: number) => {
      analyser.getByteFrequencyData(dataArray);
      if (first || now - lastEmit >= UPDATE_MS) {
        first = false;
        lastEmit = now;
        setLevels(computeLevels(dataArray, bufferLength));
      }
      rafId = requestAnimationFrame(tick);
    };

    const start = async () => {
      await audioContext.resume();
      rafId = requestAnimationFrame(tick);
    };

    void start();

    return () => {
      cancelAnimationFrame(rafId);
      source.disconnect();
      analyser.disconnect();
      void audioContext.close();
    };
  }, [stream, enabled]);

  return levels;
}
