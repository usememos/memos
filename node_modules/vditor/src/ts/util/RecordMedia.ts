export class RecordMedia {
    public SAMPLE_RATE = 5000;  // 44100 suggested by demos;
    public DEFAULT_SAMPLE_RATE: number;
    public isRecording = false;
    public readyFlag = false;
    public leftChannel: Float32List[] = [];
    public rightChannel: Float32List[] = [];
    public recordingLength = 0;
    // This needs to be public so the 'onaudioprocess' event handler can be defined externally.
    public recorder: ScriptProcessorNode;

    constructor(e: MediaStream) {
        let context;
        // creates the audio context
        if (typeof AudioContext !== "undefined") {
            context = new AudioContext();
        } else if (webkitAudioContext) {
            context = new webkitAudioContext();
        } else {
            return;
        }

        this.DEFAULT_SAMPLE_RATE = context.sampleRate;

        // creates a gain node
        const volume = context.createGain();

        // creates an audio node from the microphone incoming stream
        const audioInput = context.createMediaStreamSource(e);

        // connect the stream to the gain node
        audioInput.connect(volume);

        /* From the spec: The size of the buffer controls how frequently the audioprocess event is
         dispatched and how many sample-frames need to be processed each call.
         Lower values for buffer size will result in a lower (better) latency.
         Higher values will be necessary to avoid audio breakup and glitches */
        this.recorder = context.createScriptProcessor(2048, 2, 1);

        // The onaudioprocess event needs to be defined externally, so make sure it is not set:
        this.recorder.onaudioprocess = null;

        // we connect the recorder
        volume.connect(this.recorder);
        this.recorder.connect(context.destination);
        this.readyFlag = true;
    }

    // Publicly accessible methods:
    public cloneChannelData(leftChannelData: Float32List, rightChannelData: Float32List) {
        this.leftChannel.push(new Float32Array(leftChannelData));
        this.rightChannel.push(new Float32Array(rightChannelData));
        this.recordingLength += 2048;
    }

    public startRecordingNewWavFile() {
        if (this.readyFlag) {
            this.isRecording = true;
            this.leftChannel.length = this.rightChannel.length = 0;
            this.recordingLength = 0;
        }
    }

    public stopRecording() {
        this.isRecording = false;
    }

    public buildWavFileBlob() {
        // we flat the left and right channels down
        const leftBuffer = this.mergeBuffers(this.leftChannel);
        const rightBuffer = this.mergeBuffers(this.rightChannel);

        // Interleave the left and right channels together:
        let interleaved: Float32Array = new Float32Array(leftBuffer.length);

        for (let i = 0; i < leftBuffer.length; ++i) {
            interleaved[i] = 0.5 * (leftBuffer[i] + rightBuffer[i]);
        }

        // Downsample the audio data if necessary:
        if (this.DEFAULT_SAMPLE_RATE > this.SAMPLE_RATE) {
            interleaved = this.downSampleBuffer(interleaved, this.SAMPLE_RATE);
        }

        const totalByteCount = (44 + interleaved.length * 2);
        const buffer = new ArrayBuffer(totalByteCount);
        const view = new DataView(buffer);

        // Build the RIFF chunk descriptor:
        this.writeUTFBytes(view, 0, "RIFF");
        view.setUint32(4, totalByteCount, true);
        this.writeUTFBytes(view, 8, "WAVE");

        // Build the FMT sub-chunk:
        this.writeUTFBytes(view, 12, "fmt "); // subchunk1 ID is format
        view.setUint32(16, 16, true); // The sub-chunk size is 16.
        view.setUint16(20, 1, true); // The audio format is 1.
        view.setUint16(22, 1, true); // Number of interleaved channels.
        view.setUint32(24, this.SAMPLE_RATE, true); // Sample rate.
        view.setUint32(28, this.SAMPLE_RATE * 2, true); // Byte rate.
        view.setUint16(32, 2, true); // Block align
        view.setUint16(34, 16, true); // Bits per sample.

        // Build the data sub-chunk:
        const subChunk2ByteCount = interleaved.length * 2;
        this.writeUTFBytes(view, 36, "data");
        view.setUint32(40, subChunk2ByteCount, true);

        // Write the PCM samples to the view:
        const lng = interleaved.length;
        let index = 44;
        const volume = 1;
        for (let j = 0; j < lng; j++) {
            view.setInt16(index, interleaved[j] * (0x7FFF * volume), true);
            index += 2;
        }

        return new Blob([view], {type: "audio/wav"});
    }

    private downSampleBuffer(buffer: Float32Array, rate: number) {
        if (rate === this.DEFAULT_SAMPLE_RATE) {
            return buffer;
        }

        if (rate > this.DEFAULT_SAMPLE_RATE) {
            // throw "downsampling rate show be smaller than original sample rate";
            return buffer;
        }

        const sampleRateRatio = this.DEFAULT_SAMPLE_RATE / rate;
        const newLength = Math.round(buffer.length / sampleRateRatio);
        const result = new Float32Array(newLength);
        let offsetResult = 0;
        let offsetBuffer = 0;

        while (offsetResult < result.length) {
            const nextOffsetBuffer = Math.round((offsetResult + 1) * sampleRateRatio);
            let accum = 0;
            let count = 0;
            for (let i = offsetBuffer; i < nextOffsetBuffer && i < buffer.length; i++) {
                accum += buffer[i];
                count++;
            }
            result[offsetResult] = accum / count;
            offsetResult++;
            offsetBuffer = nextOffsetBuffer;
        }
        return result;
    }

    private mergeBuffers(desiredChannelBuffer: Float32List[]) {
        const result = new Float32Array(this.recordingLength);
        let offset = 0;
        const lng = desiredChannelBuffer.length;
        for (let i = 0; i < lng; ++i) {
            const buffer = desiredChannelBuffer[i];
            result.set(buffer, offset);
            offset += buffer.length;
        }
        return result;
    }

    private writeUTFBytes(view: DataView, offset: number, value: string) {
        const lng = value.length;
        for (let i = 0; i < lng; i++) {
            view.setUint8(offset + i, value.charCodeAt(i));
        }
    }
}
