import { Button, Stack } from "@mui/joy";
import { head } from "lodash-es";
import React, { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { useTranslation } from "react-i18next";
import * as api from "@/helpers/api";
import useLoading from "@/hooks/useLoading";
import { useMessageStore } from "@/store/zustand/message";
import { Conversation, useConversationStore } from "@/store/zustand/conversation";
import Icon from "@/components/Icon";
import { generateUUID } from "@/utils/uuid";
import MobileHeader from "@/components/MobileHeader";
import ChatMessage from "@/components/MemoChat/ChatMessage";
import ChatInput from "@/components/MemoChat/ChatInput";
import ConversationTab from "@/components/MemoChat/ConversationTab";
import Empty from "@/components/Empty";

const MemoChat = () => {
  const { t } = useTranslation();
  const fetchingState = useLoading(false);
  const [isEnabled, setIsEnabled] = useState<boolean>(true);
  const [isInIME, setIsInIME] = useState(false);
  const [question, setQuestion] = useState<string>("");
  const conversationStore = useConversationStore();
  const conversationList = conversationStore.conversationList;
  const [selectedConversationId, setSelectedConversationId] = useState<string>(head(conversationList)?.messageStorageId || "");
  const messageStore = useMessageStore(selectedConversationId)();
  const messageList = messageStore.messageList;
  // The state didn't show in component, just for trigger re-render
  const [message, setMessage] = useState<string>("");

  useEffect(() => {
    api.checkOpenAIEnabled().then(({ data }) => {
      setIsEnabled(data);
    });
  }, []);

  // to new a conversation when no conversation
  useEffect(() => {
    if (conversationList.length === 0) {
      newConversation();
    }
  }, [conversationList]);

  // to select head message conversation(conversation) when conversation be deleted
  useEffect(() => {
    setSelectedConversationId(head(conversationList)?.messageStorageId || "");
  }, [conversationList]);

  const handleGotoSystemSetting = () => {
    window.open(`/setting`);
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
    await api.chatStreaming(
      messageList,
      async (event: any) => {
        messageStore.updateMessage(messageId, event.data);
        // to trigger re-render
        setMessage(message + event.data);
      },
      async () => {
        fetchingState.setFinish();
      }
    );
  };

  const newConversation = () => {
    const uuid = generateUUID();
    // get the time HH:mm as the default name
    const name = new Date().toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });
    conversationStore.addConversation({
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
              <Icon.Bot className="w-5 h-auto mr-1" /> {t("memo-chat.title")}
            </p>
          </div>

          <span className="flex flex-row w-full justify-start items-center">
            <div className="flex space-x-2 max-w-md overflow-scroll">
              {conversationList.map((item: Conversation) => (
                <ConversationTab
                  key={item.messageStorageId}
                  item={item}
                  selectedConversationId={selectedConversationId}
                  setSelectedConversationId={setSelectedConversationId}
                  closeConversation={(e) => {
                    // this is very important. otherwise, the select event also be clicked.
                    e.stopPropagation();
                    conversationStore.removeConversation(item);
                    toast.success("Remove successfully");
                  }}
                />
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
            {messageList.length == 0 && (
              <div className="w-full mt-8 mb-8 flex flex-col justify-center items-center italic">
                <Empty />
                <p className="mt-4 text-gray-600 dark:text-gray-400">{t("memo-chat.no-message")}</p>
              </div>
            )}
            {messageList.map((message, index) => (
              <ChatMessage key={index} message={message} index={index} />
            ))}
          </Stack>
          {fetchingState.isLoading && (
            <p className="w-full py-2 mt-4 flex flex-row justify-center items-center">
              <Icon.Loader className="w-5 h-auto animate-spin" />
            </p>
          )}
          {!isEnabled && (
            <div className="w-full flex flex-col justify-center items-center mt-4 space-y-2">
              <p>{t("memo-chat.not_enabled")}</p>
              <Button onClick={() => handleGotoSystemSetting()}>{t("memo-chat.go-to-settings")}</Button>
            </div>
          )}

          <ChatInput
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

export default MemoChat;
