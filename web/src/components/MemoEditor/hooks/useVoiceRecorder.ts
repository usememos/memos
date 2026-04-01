import { useEffect, useRef } from "react";
import type { LocalFile } from "../types/attachment";
import { useBlobUrls } from "./useBlobUrls";

const FALLBACK_AUDIO_MIME_TYPE = "audio/webm";

interface VoiceRecorderActions {
  setVoiceRecorderSupport: (value: boolean) => void;
  setVoiceRecorderPermission: (value: "unknown" | "granted" | "denied") => void;
  setVoiceRecorderStatus: (value: "idle" | "requesting_permission" | "recording" | "recorded" | "error" | "unsupported") => void;
  setVoiceRecorderElapsed: (value: number) => void;
  setVoiceRecorderError: (value?: string) => void;
  setVoiceRecording: (value?: { localFile: LocalFile; durationSeconds: number; mimeType: string }) => void;
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
  const timePart = [String(now.getHours()).padStart(2, "0"), String(now.getMinutes()).padStart(2, "0")].join("");
  return new File([blob], `voice-note-${datePart}-${timePart}.${extension}`, { type: mimeType });
}

export const useVoiceRecorder = (actions: VoiceRecorderActions) => {
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef<number | null>(null);
  const elapsedTimerRef = useRef<number | null>(null);
  const recorderMimeTypeRef = useRef<string>(FALLBACK_AUDIO_MIME_TYPE);
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

    actions.setVoiceRecorderSupport(isSupported);
    if (!isSupported) {
      actions.setVoiceRecorderStatus("unsupported");
      actions.setVoiceRecorderError("Voice recording is not supported in this browser.");
      return;
    }

    actions.setVoiceRecorderStatus("idle");
    actions.setVoiceRecorderError(undefined);

    return () => {
      resetRecorderRefs();
    };
  }, [actions]);

  const startRecording = async () => {
    if (
      typeof navigator === "undefined" ||
      typeof navigator.mediaDevices?.getUserMedia !== "function" ||
      typeof MediaRecorder === "undefined"
    ) {
      actions.setVoiceRecorderSupport(false);
      actions.setVoiceRecorderStatus("unsupported");
      actions.setVoiceRecorderError("Voice recording is not supported in this browser.");
      return;
    }

    actions.setVoiceRecorderError(undefined);
    actions.setVoiceRecorderStatus("requesting_permission");
    actions.setVoiceRecorderElapsed(0);
    actions.setVoiceRecording(undefined);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = getSupportedAudioMimeType() ?? FALLBACK_AUDIO_MIME_TYPE;
      const mediaRecorder = new MediaRecorder(stream, getSupportedAudioMimeType() ? { mimeType } : undefined);

      recorderMimeTypeRef.current = mimeType;
      mediaStreamRef.current = stream;
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.addEventListener("dataavailable", (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      });

      mediaRecorder.addEventListener("stop", () => {
        const durationSeconds = startedAtRef.current ? Math.max(0, Math.round((Date.now() - startedAtRef.current) / 1000)) : 0;
        const blob = new Blob(chunksRef.current, { type: recorderMimeTypeRef.current });
        const file = createRecordedFile(blob, recorderMimeTypeRef.current);
        const previewUrl = createBlobUrl(file);

        actions.setVoiceRecording({
          localFile: {
            file,
            previewUrl,
          },
          durationSeconds,
          mimeType: recorderMimeTypeRef.current,
        });
        actions.setVoiceRecorderElapsed(durationSeconds);
        actions.setVoiceRecorderStatus("recorded");
        resetRecorderRefs();
      });

      mediaRecorder.start();
      startedAtRef.current = Date.now();
      actions.setVoiceRecorderPermission("granted");
      actions.setVoiceRecorderStatus("recording");

      elapsedTimerRef.current = window.setInterval(() => {
        if (startedAtRef.current) {
          actions.setVoiceRecorderElapsed(Math.max(0, Math.floor((Date.now() - startedAtRef.current) / 1000)));
        }
      }, 250);
    } catch (error) {
      const permissionDenied =
        error instanceof DOMException && (error.name === "NotAllowedError" || error.name === "PermissionDeniedError");

      actions.setVoiceRecorderPermission(permissionDenied ? "denied" : "unknown");
      actions.setVoiceRecorderStatus("error");
      actions.setVoiceRecorderError(permissionDenied ? "Microphone permission was denied." : "Failed to start voice recording.");
      resetRecorderRefs();
    }
  };

  const stopRecording = () => {
    if (!mediaRecorderRef.current || mediaRecorderRef.current.state === "inactive") {
      return;
    }

    cleanupTimer();
    mediaRecorderRef.current.stop();
  };

  const resetRecording = () => {
    resetRecorderRefs();
    actions.setVoiceRecorderElapsed(0);
    actions.setVoiceRecorderError(undefined);
    actions.setVoiceRecording(undefined);
    actions.setVoiceRecorderStatus("idle");
  };

  return {
    startRecording,
    stopRecording,
    resetRecording,
  };
};
