import {Constants} from "../constants";
import {uploadFiles} from "../upload/index";
import {getEventName} from "../util/compatibility";
import {RecordMedia} from "../util/RecordMedia";
import {MenuItem} from "./MenuItem";

export class Record extends MenuItem {
    constructor(vditor: IVditor, menuItem: IMenuItem) {
        super(vditor, menuItem);
        this._bindEvent(vditor);
    }

    public _bindEvent(vditor: IVditor) {
        let mediaRecorder: RecordMedia;
        this.element.children[0].addEventListener(getEventName(), (event) => {
            event.preventDefault();
            if (this.element.firstElementChild.classList.contains(Constants.CLASS_MENU_DISABLED)) {
                return;
            }
            const editorElement = vditor[vditor.currentMode].element;
            if (!mediaRecorder) {
                navigator.mediaDevices.getUserMedia({audio: true}).then((mediaStream: MediaStream) => {
                    mediaRecorder = new RecordMedia(mediaStream);
                    mediaRecorder.recorder.onaudioprocess = (e: AudioProcessingEvent) => {
                        // Do nothing if not recording:
                        if (!mediaRecorder.isRecording) {
                            return;
                        }

                        // Copy the data from the input buffers;
                        const left = e.inputBuffer.getChannelData(0);
                        const right = e.inputBuffer.getChannelData(1);
                        mediaRecorder.cloneChannelData(left, right);
                    };
                    mediaRecorder.startRecordingNewWavFile();
                    vditor.tip.show(window.VditorI18n.recording);
                    editorElement.setAttribute("contenteditable", "false");
                    this.element.children[0].classList.add("vditor-menu--current");
                }).catch(() => {
                    vditor.tip.show(window.VditorI18n["record-tip"]);
                });
                return;
            }

            if (mediaRecorder.isRecording) {
                mediaRecorder.stopRecording();
                vditor.tip.hide();
                const file: File = new File([mediaRecorder.buildWavFileBlob()],
                    `record${(new Date()).getTime()}.wav`, {type: "video/webm"});
                uploadFiles(vditor, [file]);
                this.element.children[0].classList.remove("vditor-menu--current");
            } else {
                vditor.tip.show(window.VditorI18n.recording);
                editorElement.setAttribute("contenteditable", "false");
                mediaRecorder.startRecordingNewWavFile();
                this.element.children[0].classList.add("vditor-menu--current");
            }
        });
    }
}
