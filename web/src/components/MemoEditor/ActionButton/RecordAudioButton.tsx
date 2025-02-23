import { Button } from "@usememos/mui";
import { MicIcon, StopCircleIcon } from "lucide-react";
import { useCallback, useContext, useState } from "react";
import toast from "react-hot-toast";
import { useTranslate } from "@/utils/i18n";
import { MemoEditorContext } from "../types";
import { Resource } from "@/types/proto/api/v1/resource_service";
import { useResourceStore } from "@/store/v1";

const RecordAudioButton = () => {
  const t = useTranslate();
  const context = useContext(MemoEditorContext);
  const resourceStore = useResourceStore();
  const [isRecording, setIsRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: BlobPart[] = [];

      recorder.ondataavailable = (e) => chunks.push(e.data);
      recorder.onstop = async () => {
        const blob = new Blob(chunks, { type: "audio/webm" });
        const buffer = new Uint8Array(await blob.arrayBuffer());
        
        try {
          const resource = await resourceStore.createResource({
            resource: Resource.fromPartial({
              filename: `recording-${new Date().getTime()}.webm`,
              type: "audio/webm",
              size: buffer.length,
              content: buffer
            }),
          });
          context.setResourceList([...context.resourceList, resource]);
        } catch (error: any) {
          console.error(error);
          toast.error(error.details);
        }

        stream.getTracks().forEach(track => track.stop());
      };

      recorder.start();
      setMediaRecorder(recorder);
      setIsRecording(true);
    } catch (error) {
      console.error(error);
      toast.error("无法访问麦克风");
    }
  }, [context, resourceStore]);

  const stopRecording = useCallback(() => {
    if (mediaRecorder) {
      mediaRecorder.stop();
      setMediaRecorder(null);
      setIsRecording(false);
    }
  }, [mediaRecorder]);

  return (
    <Button 
      className="relative" 
      size="sm" 
      variant="plain"
      onClick={isRecording ? stopRecording : startRecording}
    >
      {isRecording ? (
        <StopCircleIcon className="w-5 h-5 mx-auto text-red-500" />
      ) : (
        <MicIcon className="w-5 h-5 mx-auto" />
      )}
    </Button>
  );
};

export default RecordAudioButton; 