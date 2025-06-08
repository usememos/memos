import { Button } from "@usememos/mui";
import { MicIcon, StopCircleIcon } from "lucide-react";
import { useCallback, useContext, useState, useRef } from "react";
import toast from "react-hot-toast";
import { resourceStore } from "@/store/v2";
import { Resource } from "@/types/proto/api/v1/resource_service";
import { useTranslate } from "@/utils/i18n";
import { MemoEditorContext } from "../types";

// 声明 Web Speech API 类型
interface ISpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onstart: ((this: ISpeechRecognition, ev: Event) => any) | null;
  onresult: ((this: ISpeechRecognition, ev: SpeechRecognitionEvent) => any) | null;
  onerror: ((this: ISpeechRecognition, ev: SpeechRecognitionErrorEvent) => any) | null;
  onend: ((this: ISpeechRecognition, ev: Event) => any) | null;
}

interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
}

declare global {
  interface Window {
    SpeechRecognition: new () => ISpeechRecognition;
    webkitSpeechRecognition: new () => ISpeechRecognition;
  }
}

const RecordAudioButton = () => {
  const t = useTranslate();
  const context = useContext(MemoEditorContext);
  const [isRecording, setIsRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const speechRecognitionRef = useRef<ISpeechRecognition | null>(null);
  
  // 用于跟踪临时转写文本的状态
  const interimTranscriptRef = useRef<string>('');
  const finalTranscriptRef = useRef<string>('');
  const insertPositionRef = useRef<number>(0);

  // 检测浏览器是否支持语音识别
  const isSpeechRecognitionSupported = () => {
    return 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;
  };

  // 初始化语音识别
  const initSpeechRecognition = useCallback(() => {
    if (!isSpeechRecognitionSupported()) {
      return null;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'zh-CN'; // 默认中文，可以根据需要调整

    recognition.onstart = () => {
      setIsTranscribing(true);
      console.log('语音识别已开始');
      
      // 记录开始位置
      if (context.editorRef?.current) {
        const editor = context.editorRef.current;
        const currentContent = editor.getContent();
        insertPositionRef.current = currentContent.length;
        
        // 清空转写状态
        interimTranscriptRef.current = '';
        finalTranscriptRef.current = '';
      }
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interimTranscript = '';
      let finalTranscript = '';

      // 处理所有结果
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }

      if (context.editorRef?.current) {
        const editor = context.editorRef.current;
        const currentContent = editor.getContent();
        
        // 计算需要移除的旧文本长度
        const oldTextLength = finalTranscriptRef.current.length + interimTranscriptRef.current.length;
        
        // 如果有旧的转写文本，先移除它
        if (oldTextLength > 0) {
          const newContent = currentContent.slice(0, insertPositionRef.current) + 
                           currentContent.slice(insertPositionRef.current + oldTextLength);
          editor.setContent(newContent);
        }
        
        // 更新转写状态
        if (finalTranscript) {
          finalTranscriptRef.current += finalTranscript;
        }
        interimTranscriptRef.current = interimTranscript;
        
        // 插入新的转写文本
        const newTranscriptText = finalTranscriptRef.current + interimTranscript;
        if (newTranscriptText) {
          const contentBeforeInsert = editor.getContent();
          let textToInsert = newTranscriptText;
          
          // 在插入位置添加适当的空格
          if (insertPositionRef.current > 0 && 
              contentBeforeInsert[insertPositionRef.current - 1] &&
              !contentBeforeInsert[insertPositionRef.current - 1].match(/[\s\n]/)) {
            textToInsert = ' ' + textToInsert;
          }
          
          // 插入文本
          const newContent = contentBeforeInsert.slice(0, insertPositionRef.current) + 
                           textToInsert + 
                           contentBeforeInsert.slice(insertPositionRef.current);
          editor.setContent(newContent);
          
          // 设置光标位置到文本末尾
          const cursorPosition = insertPositionRef.current + textToInsert.length;
          editor.setCursorPosition(cursorPosition);
        }
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error('语音识别错误:', event.error);
      if (event.error === 'not-allowed') {
        toast.error(t("message.microphone-not-available"));
      } else {
        toast.error(`语音识别错误: ${event.error}`);
      }
    };

    recognition.onend = () => {
      setIsTranscribing(false);
      console.log('语音识别已结束');
      
      // 清空转写状态
      interimTranscriptRef.current = '';
      finalTranscriptRef.current = '';
    };

    return recognition;
  }, [t, context]);

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

          // 录音完成提示
          toast.success(`录音和转写已完成`);
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

      // 开始语音识别
      if (isSpeechRecognitionSupported()) {
        const recognition = initSpeechRecognition();
        if (recognition) {
          speechRecognitionRef.current = recognition;
          recognition.start();
        }
      } else {
        toast.error("您的浏览器不支持语音识别功能");
      }

    } catch (error) {
      console.error(error);
      toast.error(t("message.microphone-not-available"));
    }
  }, [context, resourceStore, t, initSpeechRecognition]);

  const stopRecording = useCallback(() => {
    if (mediaRecorder) {
      mediaRecorder.stop();
      setMediaRecorder(null);
      setIsRecording(false);
    }

    // 停止语音识别
    if (speechRecognitionRef.current) {
      speechRecognitionRef.current.stop();
      speechRecognitionRef.current = null;
    }

    setIsTranscribing(false);
  }, [mediaRecorder]);

  return (
    <Button 
      className={`p-0 relative ${isTranscribing ? 'text-green-500' : ''}`} 
      size="sm" 
      variant="plain" 
      onClick={isRecording ? stopRecording : startRecording}
    >
      {isRecording ? <StopCircleIcon className="w-5 h-5 mx-auto text-red-500" /> : <MicIcon className="w-5 h-5 mx-auto" />}
    </Button>
  );
};

export default RecordAudioButton;
