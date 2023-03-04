import { Button, Textarea } from "@mui/joy";
import { reverse } from "lodash-es";
import { useEffect, useState } from "react";
import * as api from "../helpers/api";
import useLoading from "../hooks/useLoading";
import { marked } from "../labs/marked";
import Icon from "./Icon";
import { generateDialog } from "./Dialog";
import toastHelper from "./Toast";
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

  const handleQuestionTextareaKeyDown = async (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      const question = event.currentTarget.value;
      event.currentTarget.value = "";

      fetchingState.setLoading();
      try {
        await askQuestion(question);
      } catch (error: any) {
        console.error(error);
        toastHelper.error(error.response.data.error);
      }
      fetchingState.setFinish();
    }
  };

  const askQuestion = async (question: string) => {
    if (question === "") {
      return;
    }

    const {
      data: { data: answer },
    } = await api.postChatCompletion(question);
    setHistoryList([
      ...historyList,
      {
        question,
        answer: answer.replace(/^\n\n/, ""),
      },
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
      <div className="dialog-content-container !w-112">
        <Textarea className="w-full" placeholder="Ask anything…" onKeyDown={handleQuestionTextareaKeyDown} />
        {fetchingState.isLoading && (
          <p className="w-full py-2 mt-4 flex flex-row justify-center items-center">
            <Icon.Loader className="w-5 h-auto animate-spin" />
          </p>
        )}
        {reverse(historyList).map((history, index) => (
          <div key={index} className="w-full flex flex-col justify-start items-start mt-4 space-y-2">
            <div className="w-full flex flex-row justify-start items-start pr-6">
              <span className="word-break rounded shadow px-3 py-2 opacity-80 bg-gray-100 dark:bg-zinc-700">{history.question}</span>
            </div>
            <div className="w-full flex flex-row justify-end items-start pl-8 space-x-2">
              <div className="memo-content-wrapper !w-auto flex flex-col justify-start items-start rounded shadow px-3 py-2 bg-gray-100 dark:bg-zinc-700">
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
