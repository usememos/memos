import { Button, Textarea } from "@mui/joy";
import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import * as api from "../helpers/api";
import useLoading from "../hooks/useLoading";
import { marked } from "../labs/marked";
import { useMessageStore } from "../store/zustand/message";
import Icon from "./Icon";
import { generateDialog } from "./Dialog";
import showSettingDialog from "./SettingDialog";
import { useTranslation } from "react-i18next";

type Props = DialogProps;

const AskAIDialog: React.FC<Props> = (props: Props) => {
  const { t } = useTranslation();
  const { destroy, hide } = props;
  const fetchingState = useLoading(false);
  const messageStore = useMessageStore();
  const [isEnabled, setIsEnabled] = useState<boolean>(true);
  const [isInIME, setIsInIME] = useState(false);
  const [question, setQuestion] = useState<string>("");
  const messageList = messageStore.messageList;

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
    if (!question) {
      return;
    }

    fetchingState.setLoading();
    setQuestion("");
    messageStore.addMessage({
      role: "user",
      content: question,
    });
    try {
      await fetchChatCompletion();
    } catch (error: any) {
      console.error(error);
      toast.error(error.response.data.error);
    }
    fetchingState.setFinish();
  };

  const fetchChatCompletion = async () => {
    const messageList = messageStore.getState().messageList;
    const {
      data: { data: answer },
    } = await api.postChatCompletion(messageList);
    messageStore.addMessage({
      role: "assistant",
      content: answer.replace(/^\n\n/, ""),
    });
  };

  return (
    <>
      <div className="dialog-header-container">
        <p className="title-text flex flex-row items-center">
          <Icon.Bot className="mr-1 w-5 h-auto opacity-80" />
          {t("ask-ai.title")}
        </p>
        <button className="btn close-btn" onClick={() => hide()}>
          <Icon.X />
        </button>
      </div>
      <div className="dialog-content-container !w-112 max-w-full">
        {messageList.map((message, index) => (
          <div key={index} className="w-full flex flex-col justify-start items-start mt-4 space-y-2">
            {message.role === "user" ? (
              <div className="w-full flex flex-row justify-end items-start pl-6">
                <span className="word-break shadow rounded-lg rounded-tr-none px-3 py-2 opacity-80 bg-gray-100 dark:bg-zinc-700">
                  {message.content}
                </span>
              </div>
            ) : (
              <div className="w-full flex flex-row justify-start items-start pr-8 space-x-2">
                <Icon.Bot className="mt-2 flex-shrink-0 mr-1 w-6 h-auto opacity-80" />
                <div className="memo-content-wrapper !w-auto flex flex-col justify-start items-start shadow rounded-lg rounded-tl-none px-3 py-2 bg-gray-100 dark:bg-zinc-700">
                  <div className="memo-content-text">{marked(message.content)}</div>
                </div>
              </div>
            )}
          </div>
        ))}
        {fetchingState.isLoading && (
          <p className="w-full py-2 mt-4 flex flex-row justify-center items-center">
            <Icon.Loader className="w-5 h-auto animate-spin" />
          </p>
        )}
        {!isEnabled && (
          <div className="w-full flex flex-col justify-center items-center mt-4 space-y-2">
            <p>{t("ask-ai.not_enabled")}</p>
            <Button onClick={() => handleGotoSystemSetting()}>{t("ask-ai.go-to-settings")}</Button>
          </div>
        )}
        <div className="w-full relative mt-4">
          <Textarea
            className="w-full"
            placeholder={t("ask-ai.placeholder")}
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
