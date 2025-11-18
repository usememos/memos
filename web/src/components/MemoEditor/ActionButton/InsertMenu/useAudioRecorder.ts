import { useRef, useState } from "react";

interface AudioRecorderState {
    isRecording: boolean;
    isPaused: boolean;
    recordingTime: number;
    mediaRecorder: MediaRecorder | null;
}

export const useAudioRecorder = () => {
    const [state, setState] = useState<AudioRecorderState>({
        isRecording: false,
        isPaused: false,
        recordingTime: 0,
        mediaRecorder: null,
    });
    const chunksRef = useRef<Blob[]>([]);
    const timerRef = useRef<number | null>(null);

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mediaRecorder = new MediaRecorder(stream);
            chunksRef.current = [];

            mediaRecorder.ondataavailable = (e: BlobEvent) => {
                if (e.data.size > 0) {
                    chunksRef.current.push(e.data);
                }
            };

            mediaRecorder.start();
            setState((prev: AudioRecorderState) => ({ ...prev, isRecording: true, mediaRecorder }));

            timerRef.current = window.setInterval(() => {
                setState((prev) => {
                    if (prev.isPaused) {
                        return prev;
                    }
                    return { ...prev, recordingTime: prev.recordingTime + 1 };
                });
            }, 1000);
        } catch (error) {
            console.error("Error accessing microphone:", error);
            throw error;
        }
    };

    const stopRecording = (): Promise<Blob> => {
        return new Promise((resolve, reject) => {
            const { mediaRecorder } = state;
            if (!mediaRecorder) {
                reject(new Error("No active recording"));
                return;
            }

            mediaRecorder.onstop = () => {
                const blob = new Blob(chunksRef.current, { type: "audio/webm" });
                chunksRef.current = [];
                resolve(blob);
            };

            mediaRecorder.stop();
            mediaRecorder.stream.getTracks().forEach((track: MediaStreamTrack) => track.stop());

            if (timerRef.current) {
                clearInterval(timerRef.current);
                timerRef.current = null;
            }

            setState({
                isRecording: false,
                isPaused: false,
                recordingTime: 0,
                mediaRecorder: null,
            });
        });
    };

    const cancelRecording = () => {
        const { mediaRecorder } = state;
        if (mediaRecorder) {
            mediaRecorder.stop();
            mediaRecorder.stream.getTracks().forEach((track: MediaStreamTrack) => track.stop());
        }

        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }

        chunksRef.current = [];
        setState({
            isRecording: false,
            isPaused: false,
            recordingTime: 0,
            mediaRecorder: null,
        });
    };

    const togglePause = () => {
        const { mediaRecorder, isPaused } = state;
        if (!mediaRecorder) return;

        if (isPaused) {
            mediaRecorder.resume();
        } else {
            mediaRecorder.pause();
        }

        setState((prev) => ({ ...prev, isPaused: !prev.isPaused }));
    };

    return {
        isRecording: state.isRecording,
        isPaused: state.isPaused,
        recordingTime: state.recordingTime,
        startRecording,
        stopRecording,
        cancelRecording,
        togglePause,
    };
};
