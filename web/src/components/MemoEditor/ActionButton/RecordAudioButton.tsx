import { Button } from "@usememos/mui";
import { MicIcon, StopCircleIcon } from "lucide-react";
import { useCallback, useContext, useState } from "react";
import toast from "react-hot-toast";
import { useResourceStore } from "@/store/v1";
import { Resource } from "@/types/proto/api/v1/resource_service";
import { useTranslate } from "@/utils/i18n";
import { MemoEditorContext } from "../types";

const RecordAudioButton = () => {
  const t = useTranslate();
  const context = useContext(MemoEditorContext);
  const resourceStore = useResourceStore();
  const [isRecording, setIsRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);

  // 检测浏览器支持的音频格式
  const getSupportedMimeType = () => {
    const types = ["audio/webm", "audio/mp4", "audio/aac", "audio/wav", "audio/ogg"];

    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) {
        return type;
      }
    }
    return null;
  };

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      const mimeType = getSupportedMimeType();
      if (!mimeType) {
        throw new Error("No supported audio format found");
      }

      const recorder = new MediaRecorder(stream, {
        mimeType: mimeType,
      });

      const chunks: BlobPart[] = [];

      recorder.ondataavailable = (e) => chunks.push(e.data);
      recorder.onstop = async () => {
        const blob = new Blob(chunks, { type: mimeType });
        const buffer = new Uint8Array(await blob.arrayBuffer());

        // 根据不同的 mimeType 选择合适的文件扩展名
        const getFileExtension = (mimeType: string) => {
          switch (mimeType) {
            case "audio/webm":
              return "webm";
            case "audio/mp4":
              return "m4a";
            case "audio/aac":
              return "aac";
            case "audio/wav":
              return "wav";
            case "audio/ogg":
              return "ogg";
            default:
              return "webm";
          }
        };

        try {
          const resource = await resourceStore.createResource({
            resource: Resource.fromPartial({
              filename: `recording-${new Date().getTime()}.${getFileExtension(mimeType)}`,
              type: mimeType,
              size: buffer.length,
              content: buffer,
            }),
          });
          context.setResourceList([...context.resourceList, resource]);
        } catch (error: any) {
          console.error(error);
          toast.error(error.details);
        }

        stream.getTracks().forEach((track) => track.stop());
      };

      // 每秒记录一次数据
      recorder.start(1000);
      setMediaRecorder(recorder);
      setIsRecording(true);
    } catch (error) {
      console.error(error);
      toast.error(t("message.microphone-not-available"));
    }
  }, [context, resourceStore, t]);

  const stopRecording = useCallback(() => {
    if (mediaRecorder) {
      mediaRecorder.stop();
      setMediaRecorder(null);
      setIsRecording(false);
    }
  }, [mediaRecorder]);

  return (
    <Button className="relative" size="sm" variant="plain" onClick={isRecording ? stopRecording : startRecording}>
      {isRecording ? <StopCircleIcon className="w-5 h-5 mx-auto text-red-500" /> : <MicIcon className="w-5 h-5 mx-auto" />}
    </Button>
  );
};

export default RecordAudioButton;
