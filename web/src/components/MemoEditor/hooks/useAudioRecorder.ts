import { useEffect, useRef, useState } from "react";
import type { LocalFile } from "../types/attachment";
import { useBlobUrls } from "./useBlobUrls";

const FALLBACK_AUDIO_MIME_TYPE = "audio/webm";
export type AudioRecordingCompleteMode = "attach" | "transcribe";

interface AudioRecorderActions {
  setAudioRecorderSupport: (value: boolean) => void;
  setAudioRecorderPermission: (value: "unknown" | "granted" | "denied") => void;
  setAudioRecorderStatus: (value: "idle" | "requesting_permission" | "recording" | "error" | "unsupported") => void;
  setAudioRecorderElapsed: (value: number) => void;
  setAudioRecorderError: (value?: string) => void;
  onRecordingComplete: (localFile: LocalFile, mode: AudioRecordingCompleteMode) => void;
  onRecordingEmpty?: (mode: AudioRecordingCompleteMode) => void;
}

const AUDIO_MIME_TYPE_CANDIDATES = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"] as const;

function getSupportedAudioMimeType(): string | undefined {
  if (typeof window === "undefined" || typeof MediaRecorder === "undefined") {
    return undefined;
  }

  for (const candidate of AUDIO_MIME_TYPE_CANDIDATES) {
    if (MediaRecorder.isTypeSupported(candidate)) {
      return candidate;
    }
  }

  return undefined;
}

function getFileExtension(mimeType: string): string {
  if (mimeType.includes("ogg")) return "ogg";
  if (mimeType.includes("mp4")) return "m4a";
  return "webm";
}

function createRecordedFile(blob: Blob, mimeType: string): File {
  const extension = getFileExtension(mimeType);
  const now = new Date();
  const datePart = [now.getFullYear(), String(now.getMonth() + 1).padStart(2, "0"), String(now.getDate()).padStart(2, "0")].join("");
  const timePart = [
    String(now.getHours()).padStart(2, "0"),
    String(now.getMinutes()).padStart(2, "0"),
    String(now.getSeconds()).padStart(2, "0"),
  ].join("");
  return new File([blob], `voice-note-${datePart}-${timePart}.${extension}`, { type: mimeType });
}

export const useAudioRecorder = (actions: AudioRecorderActions) => {
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const [recordingStream, setRecordingStream] = useState<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef<number | null>(null);
  const elapsedTimerRef = useRef<number | null>(null);
  const recorderMimeTypeRef = useRef<string>(FALLBACK_AUDIO_MIME_TYPE);
  const completionModeRef = useRef<AudioRecordingCompleteMode>("attach");
  const startRequestIdRef = useRef(0);
  const { createBlobUrl } = useBlobUrls();

  const cleanupTimer = () => {
    if (elapsedTimerRef.current !== null) {
      window.clearInterval(elapsedTimerRef.current);
      elapsedTimerRef.current = null;
    }
  };

  const cleanupStream = () => {
    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    mediaStreamRef.current = null;
    setRecordingStream(null);
  };

  const resetRecorderRefs = () => {
    cleanupTimer();
    cleanupStream();
    mediaRecorderRef.current = null;
    chunksRef.current = [];
    startedAtRef.current = null;
  };

  useEffect(() => {
    const isSupported =
      typeof window !== "undefined" &&
      typeof navigator !== "undefined" &&
      typeof navigator.mediaDevices?.getUserMedia === "function" &&
      typeof MediaRecorder !== "undefined";

    actions.setAudioRecorderSupport(isSupported);
    if (!isSupported) {
      actions.setAudioRecorderStatus("unsupported");
      actions.setAudioRecorderError("Audio recording is not supported in this browser.");
      return;
    }

    actions.setAudioRecorderStatus("idle");
    actions.setAudioRecorderError(undefined);

    return () => {
      resetRecorderRefs();
    };
  }, [actions]);

  const startRecording = async () => {
    const requestId = startRequestIdRef.current + 1;
    startRequestIdRef.current = requestId;

    if (
      typeof navigator === "undefined" ||
      typeof navigator.mediaDevices?.getUserMedia !== "function" ||
      typeof MediaRecorder === "undefined"
    ) {
      actions.setAudioRecorderSupport(false);
      actions.setAudioRecorderStatus("unsupported");
      actions.setAudioRecorderError("Audio recording is not supported in this browser.");
      return;
    }

    actions.setAudioRecorderError(undefined);
    actions.setAudioRecorderStatus("requesting_permission");
    actions.setAudioRecorderElapsed(0);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (startRequestIdRef.current !== requestId) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      const mimeType = getSupportedAudioMimeType() ?? FALLBACK_AUDIO_MIME_TYPE;
      const mediaRecorder = new MediaRecorder(stream, getSupportedAudioMimeType() ? { mimeType } : undefined);

      recorderMimeTypeRef.current = mimeType;
      mediaStreamRef.current = stream;
      setRecordingStream(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.addEventListener("dataavailable", (event) => {
        if (startRequestIdRef.current !== requestId) {
          return;
        }

        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      });

      mediaRecorder.addEventListener("stop", () => {
        if (startRequestIdRef.current !== requestId) {
          return;
        }

        const durationSeconds = startedAtRef.current ? Math.max(0, Math.round((Date.now() - startedAtRef.current) / 1000)) : 0;
        const blob = new Blob(chunksRef.current, { type: recorderMimeTypeRef.current });
        const completionMode = completionModeRef.current;
        completionModeRef.current = "attach";
        if (blob.size === 0) {
          actions.setAudioRecorderElapsed(0);
          actions.setAudioRecorderError(undefined);
          actions.setAudioRecorderStatus("idle");
          actions.onRecordingEmpty?.(completionMode);
          resetRecorderRefs();
          return;
        }

        const file = createRecordedFile(blob, recorderMimeTypeRef.current);
        const previewUrl = createBlobUrl(file);

        actions.onRecordingComplete(
          {
            file,
            previewUrl,
            origin: "audio_recording",
            audioMeta: {
              durationSeconds,
            },
          },
          completionMode,
        );
        actions.setAudioRecorderElapsed(0);
        actions.setAudioRecorderError(undefined);
        actions.setAudioRecorderStatus("idle");
        resetRecorderRefs();
      });

      mediaRecorder.start();
      startedAtRef.current = Date.now();
      actions.setAudioRecorderPermission("granted");
      actions.setAudioRecorderStatus("recording");

      elapsedTimerRef.current = window.setInterval(() => {
        if (startedAtRef.current) {
          actions.setAudioRecorderElapsed(Math.max(0, Math.floor((Date.now() - startedAtRef.current) / 1000)));
        }
      }, 250);
    } catch (error) {
      if (startRequestIdRef.current !== requestId) {
        return;
      }

      const permissionDenied =
        error instanceof DOMException && (error.name === "NotAllowedError" || error.name === "PermissionDeniedError");

      actions.setAudioRecorderPermission(permissionDenied ? "denied" : "unknown");
      actions.setAudioRecorderStatus("error");
      actions.setAudioRecorderError(permissionDenied ? "Microphone permission was denied." : "Failed to start audio recording.");
      resetRecorderRefs();
    }
  };

  const stopRecording = (mode: AudioRecordingCompleteMode = "attach") => {
    if (!mediaRecorderRef.current || mediaRecorderRef.current.state === "inactive") {
      return false;
    }

    completionModeRef.current = mode;
    cleanupTimer();
    mediaRecorderRef.current.stop();
    return true;
  };

  const resetRecording = () => {
    startRequestIdRef.current += 1;
    completionModeRef.current = "attach";
    resetRecorderRefs();
    actions.setAudioRecorderElapsed(0);
    actions.setAudioRecorderError(undefined);
    actions.setAudioRecorderStatus("idle");
  };

  return {
    startRecording,
    stopRecording,
    resetRecording,
    recordingStream,
  };
};
