import { useEffect, useRef, useState } from "react";

export const useAudioRecorder = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);

  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const durationRef = useRef<number>(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);

  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current) {
        mediaRecorderRef.current.stream.getTracks().forEach((track) => track.stop());
        mediaRecorderRef.current = null;
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, []);

  const startRecording = async () => {
    let stream: MediaStream | null = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      durationRef.current = 0;
      setRecordingTime(0);

      recorder.ondataavailable = (e: BlobEvent) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      recorder.start();
      mediaRecorderRef.current = recorder;

      setIsRecording(true);
      setIsPaused(false);

      timerRef.current = window.setInterval(() => {
        if (!mediaRecorderRef.current || mediaRecorderRef.current.state === "paused") {
          return;
        }
        durationRef.current += 1;
        setRecordingTime(durationRef.current);
      }, 1000);
    } catch (error) {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
      console.error("Error accessing microphone:", error);
      throw error;
    }
  };

  const stopRecording = (): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      // Cleanup timer immediately to prevent further updates
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }

      const recorder = mediaRecorderRef.current;
      if (!recorder) {
        reject(new Error("No active recording"));
        return;
      }

      let isResolved = false;

      const finalize = () => {
        if (isResolved) return;
        isResolved = true;

        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        chunksRef.current = [];
        durationRef.current = 0;

        setIsRecording(false);
        setIsPaused(false);
        setRecordingTime(0);

        mediaRecorderRef.current = null;

        resolve(blob);
      };

      recorder.onstop = finalize;

      try {
        recorder.stop();
        recorder.stream.getTracks().forEach((track: MediaStreamTrack) => track.stop());
      } catch (error) {
        // Ignore errors during stop, as we'll finalize anyway
        console.warn("Error stopping media recorder:", error);
      }

      // Safety timeout in case onstop never fires
      setTimeout(finalize, 1000);
    });
  };

  const cancelRecording = () => {
    // Cleanup timer immediately
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    const recorder = mediaRecorderRef.current;
    if (recorder) {
      recorder.stop();
      recorder.stream.getTracks().forEach((track: MediaStreamTrack) => track.stop());
    }

    chunksRef.current = [];
    durationRef.current = 0;

    setIsRecording(false);
    setIsPaused(false);
    setRecordingTime(0);

    mediaRecorderRef.current = null;
  };

  const togglePause = () => {
    const recorder = mediaRecorderRef.current;
    if (!recorder) return;

    if (isPaused) {
      recorder.resume();
      setIsPaused(false);
    } else {
      recorder.pause();
      setIsPaused(true);
    }
  };

  return {
    isRecording,
    isPaused,
    recordingTime,
    startRecording,
    stopRecording,
    cancelRecording,
    togglePause,
  };
};
