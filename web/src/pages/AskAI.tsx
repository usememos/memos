import { Button, Stack } from "@mui/joy";
import React, { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { useTranslation } from "react-i18next";
import * as api from "@/helpers/api";
import useLoading from "@/hooks/useLoading";
import { useMessageStore } from "@/store/zustand/message";
import { MessageGroup, useMessageGroupStore } from "@/store/zustand/message-group";
import Icon from "@/components/Icon";
import showSettingDialog from "../components/SettingDialog";
import { fetchEventSource } from "@microsoft/fetch-event-source";
import { generateUUID } from "@/utils/uuid";
import MobileHeader from "@/components/MobileHeader";
import AskAIMessage from "@/components/AskAIMessage";
import AskAIInput from "@/components/AskAIInput";
import head from "lodash-es/head";

const AskAI = () => {
  const { t } = useTranslation();
  const fetchingState = useLoading(false);
  const [isEnabled, setIsEnabled] = useState<boolean>(true);
  const [isInIME, setIsInIME] = useState(false);
  const [question, setQuestion] = useState<string>("");

  const messageGroupStore = useMessageGroupStore();
  const messageGroupList = messageGroupStore.groupList;

  const [selectedConversationId, setSelectedConversationId] = useState<string>(head(messageGroupList)?.messageStorageId || "");
  const messageStore = useMessageStore(selectedConversationId)();
  const messageList = messageStore.messageList;

  const [message, setMessage] = useState<string>("");

  useEffect(() => {
    api.checkOpenAIEnabled().then(({ data }) => {
      const { data: enabled } = data;
      setIsEnabled(enabled);
    });
  }, []);

  // to new a conversation when no conversation
  useEffect(() => {
    if (messageGroupList.length === 0) {
      newConversation();
    }
  }, [messageGroupList]);

  // to select head message group(conversation) when conversation be deleted
  useEffect(() => {
    setSelectedConversationId(head(messageGroupList)?.messageStorageId || "");
  }, [messageGroupList]);

  const handleGotoSystemSetting = () => {
    showSettingDialog("system");
  };

  const handleQuestionTextareaChange = async (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setQuestion(event.currentTarget.value);
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Enter" && !event.shiftKey && !isInIME) {
      event.preventDefault();
      handleSendQuestionButtonClick().then();
    }
  };

  const handleSendQuestionButtonClick = async () => {
    if (!question) {
      return;
    }

    fetchingState.setLoading();
    setQuestion("");
    messageStore.addMessage({
      id: generateUUID(),
      role: "user",
      content: question,
    });

    const messageId = generateUUID();
    messageStore.addMessage({
      id: messageId,
      role: "assistant",
      content: "",
    });
    try {
      fetchChatStreaming(messageId);
    } catch (error: any) {
      console.error(error);
      toast.error(error.response.data.error);
    }
  };

  const fetchChatStreaming = async (messageId: string) => {
    const messageList = messageStore.getState().messageList;

    let finished = false;

    const finish = () => {
      if (!finished) {
        finished = true;
        fetchingState.setFinish();
      }
    };

    await fetchEventSource("/api/openai/chat-streaming", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(messageList),
      async onopen() {
        // to process somethings. But I didn't think of anything to do.
      },
      onmessage(ev) {
        messageStore.updateMessage(messageId, ev.data);
        setMessage(message + ev.data);
      },
      onclose() {
        finish();
      },
      onerror(error) {
        console.log("error", error);
      },
    });
  };

  const newConversation = () => {
    const uuid = generateUUID();
    // get the time HH:mm as the default name
    const name = new Date().toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });
    messageGroupStore.addGroup({
      name: name,
      messageStorageId: uuid,
    });
    setSelectedConversationId(uuid);
  };

  return (
    <section className="w-full max-w-2xl min-h-full flex flex-col justify-start items-center px-4 sm:px-2 sm:pt-4 pb-8 bg-zinc-100 dark:bg-zinc-800">
      <MobileHeader showSearch={false} />
      <div className="w-full flex flex-col justify-start items-start px-4 py-3 rounded-xl bg-white dark:bg-zinc-700 text-black dark:text-gray-300">
        <div className="flex space-x-2">
          <div className="w-full flex flex-row justify-between items-center">
            <p className="flex flex-row justify-start items-center select-none rounded">
              <Icon.Bot className="w-5 h-auto mr-1" /> {t("ask-ai.title")}
            </p>
          </div>

          <span className="flex flex-row w-full justify-start items-center">
            <div className="flex space-x-2 max-w-md overflow-scroll">
              {messageGroupList.map((item: MessageGroup) => (
                <div
                  className={`flex bg-zinc-100 dark:bg-zinc-800 rounded-md p-2 ${
                    selectedConversationId === item.messageStorageId ? "border-2 dark:border-zinc-600" : ""
                  }`}
                  key={item.messageStorageId}
                  onClick={() => {
                    setSelectedConversationId(item.messageStorageId);
                  }}
                >
                  <div className="truncate">{item.name}</div>
                  <Icon.X
                    className="w-4 h-auto ml-1 cursor-pointer"
                    onClick={(e: any) => {
                      // this is very important. otherwise, the select event also be clicked.
                      e.stopPropagation();
                      messageGroupStore.removeGroup(item);
                      toast.success("Remove successfully");
                    }}
                  />
                </div>
              ))}
            </div>

            <button className="btn-text px-1 ml-1">
              <Icon.Plus
                className="w-4 h-auto"
                onClick={() => {
                  newConversation();
                }}
              />
            </button>
          </span>
        </div>

        <div className="dialog-content-container w-full">
          <Stack spacing={2} style={{ width: "100%" }}>
            {messageList.length == 0 && <div className="flex m-auto text-gray-500">Nothing here</div>}
            {messageList.map((message, index) => (
              <AskAIMessage key={index} message={message} index={index} />
            ))}
          </Stack>
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

          <AskAIInput
            question={question}
            handleQuestionTextareaChange={handleQuestionTextareaChange}
            setIsInIME={setIsInIME}
            handleKeyDown={handleKeyDown}
            handleSendQuestionButtonClick={handleSendQuestionButtonClick}
          />
        </div>
      </div>
    </section>
  );
};

export default AskAI;
