export declare class RecordMedia {
    SAMPLE_RATE: number;
    DEFAULT_SAMPLE_RATE: number;
    isRecording: boolean;
    readyFlag: boolean;
    leftChannel: Float32List[];
    rightChannel: Float32List[];
    recordingLength: number;
    recorder: ScriptProcessorNode;
    constructor(e: MediaStream);
    cloneChannelData(leftChannelData: Float32List, rightChannelData: Float32List): void;
    startRecordingNewWavFile(): void;
    stopRecording(): void;
    buildWavFileBlob(): Blob;
    private downSampleBuffer;
    private mergeBuffers;
    private writeUTFBytes;
}
