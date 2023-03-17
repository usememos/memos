import { Button, Textarea } from "@mui/joy";
import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import * as api from "../helpers/api";
import useLoading from "../hooks/useLoading";
import { marked } from "../labs/marked";
import Icon from "./Icon";
import { generateDialog } from "./Dialog";
import showSettingDialog from "./SettingDialog";

type Props = DialogProps;

interface History {
  question: string;
  answer: string;
}

const AskAIDialog: React.FC<Props> = (props: Props) => {
  const { destroy, hide } = props;
  const fetchingState = useLoading(false);
  const [historyList, setHistoryList] = useState<History[]>([]);
  const [isEnabled, setIsEnabled] = useState<boolean>(true);
  const [isInIME, setIsInIME] = useState(false);
  const [question, setQuestion] = useState<string>("");

  useEffect(() => {
    api.checkOpenAIEnabled().then(({ data }) => {
      const { data: enabled } = data;
      setIsEnabled(enabled);
    });
  }, []);

  const handleGotoSystemSetting = () => {
    showSettingDialog("system");
    destroy();
  };

  const handleQuestionTextareaChange = async (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setQuestion(event.currentTarget.value);
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Enter" && !event.shiftKey && !isInIME) {
      event.preventDefault();
      handleSendQuestionButtonClick();
    }
  };

  const handleSendQuestionButtonClick = async () => {
    fetchingState.setLoading();
    setQuestion("");
    try {
      await askQuestion(question);
    } catch (error: any) {
      console.error(error);
      toast.error(error.response.data.error);
    }
    fetchingState.setFinish();
  };

  const askQuestion = async (question: string) => {
    if (question === "") {
      return;
    }

    const {
      data: { data: answer },
    } = await api.postChatCompletion(question);
    setHistoryList([
      {
        question,
        answer: answer.replace(/^\n\n/, ""),
      },
      ...historyList,
    ]);
  };

  return (
    <>
      <div className="dialog-header-container">
        <p className="title-text flex flex-row items-center">
          <Icon.Bot className="mr-1 w-5 h-auto opacity-80" />
          Ask AI
        </p>
        <button className="btn close-btn" onClick={() => hide()}>
          <Icon.X />
        </button>
      </div>
      <div className="dialog-content-container !w-112 max-w-full">
        <div className="w-full relative">
          <Textarea
            className="w-full"
            placeholder="Ask anything…"
            value={question}
            minRows={1}
            maxRows={5}
            onChange={handleQuestionTextareaChange}
            onCompositionStart={() => setIsInIME(true)}
            onCompositionEnd={() => setIsInIME(false)}
            onKeyDown={handleKeyDown}
          />
          <Icon.Send
            className="cursor-pointer w-7 p-1 h-auto rounded-md bg-gray-100 dark:bg-zinc-800 absolute right-2 bottom-1.5 shadow hover:opacity-80"
            onClick={handleSendQuestionButtonClick}
          />
        </div>
        {fetchingState.isLoading && (
          <p className="w-full py-2 mt-4 flex flex-row justify-center items-center">
            <Icon.Loader className="w-5 h-auto animate-spin" />
          </p>
        )}
        {historyList.map((history, index) => (
          <div key={index} className="w-full flex flex-col justify-start items-start mt-4 space-y-2">
            <div className="w-full flex flex-row justify-start items-start pr-6">
              <span className="word-break rounded-lg rounded-tl-none px-3 py-2 opacity-80 bg-gray-100 dark:bg-zinc-700">
                {history.question}
              </span>
            </div>
            <div className="w-full flex flex-row justify-end items-start pl-8 space-x-2">
              <div className="memo-content-wrapper !w-auto flex flex-col justify-start items-start rounded-lg rounded-tr-none px-3 py-2 bg-gray-100 dark:bg-zinc-700">
                <div className="memo-content-text">{marked(history.answer)}</div>
              </div>
              <Icon.Bot className="mt-2 flex-shrink-0 mr-1 w-6 h-auto opacity-80" />
            </div>
          </div>
        ))}
        {!isEnabled && (
          <div className="w-full flex flex-col justify-center items-center mt-4 space-y-2">
            <p>You have not set up your OpenAI API key.</p>
            <Button onClick={() => handleGotoSystemSetting()}>Go to settings</Button>
          </div>
        )}
      </div>
    </>
  );
};

function showAskAIDialog() {
  const dialogname = "ask-ai-dialog";
  const dialogElement = document.body.querySelector(`div.${dialogname}`);
  if (dialogElement) {
    dialogElement.classList.remove("showoff");
    dialogElement.classList.add("showup");
  } else {
    generateDialog(
      {
        className: dialogname,
        dialogName: dialogname,
      },
      AskAIDialog
    );
  }
}

export default showAskAIDialog;
