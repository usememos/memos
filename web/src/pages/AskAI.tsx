import { Button, Stack } from "@mui/joy";
import React, { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { useTranslation } from "react-i18next";
import * as api from "@/helpers/api";
import useLoading from "@/hooks/useLoading";
import { useMessageStore } from "@/store/zustand/message";
import { defaultMessageGroup, MessageGroup, useMessageGroupStore } from "@/store/zustand/message-group";
import Icon from "@/components/Icon";
// import { generateDialog } from "./Dialog";
import showSettingDialog from "../components/SettingDialog";
// import Selector from "../components/kit/Selector";
import { fetchEventSource } from "@microsoft/fetch-event-source";
import { generateUUID } from "@/utils/uuid";
import MobileHeader from "@/components/MobileHeader";
import AskAIMessage from "@/components/AskAIMessage";
import AskAIInput from "@/components/AskAIInput";

const AskAI = () => {
  const { t } = useTranslation();
  //   const { destroy, hide } = props;
  const fetchingState = useLoading(false);
  const [messageGroup, setMessageGroup] = useState<MessageGroup>(defaultMessageGroup);
  const messageStore = useMessageStore(messageGroup)();
  const [isEnabled, setIsEnabled] = useState<boolean>(true);
  const [isInIME, setIsInIME] = useState(false);
  const [question, setQuestion] = useState<string>("");
  const messageList = messageStore.messageList;

  const [message, setMessage] = useState<string>("");

  useEffect(() => {
    api.checkOpenAIEnabled().then(({ data }) => {
      const { data: enabled } = data;
      setIsEnabled(enabled);
    });
  }, []);

  const handleGotoSystemSetting = () => {
    showSettingDialog("system");
    // destroy();
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
    // const {
    //   data: { data: answer },
    // } = await api.postChatStreaming(messageList);
    // messageStore.addMessage({
    //   role: "assistant",
    //   content: answer.replace(/^\n\n/, ""),
    // });

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
        console.log("open");
      },
      onmessage(ev) {
        messageStore.updateMessage(messageId, ev.data);
        setMessage(message + ev.data);
      },
      onclose() {
        console.log("close");
        finish();
      },
      onerror(error) {
        console.log("error", error);
      },
    });
  };

  // const fetchChatCompletion = async () => {
  //   const messageList = messageStore.getState().messageList;
  //   const {
  //   data: { data: answer },
  //   } = await api.postChatCompletion(messageList);
  //   messageStore.addMessage({
  //   role: "assistant",
  //   content: answer.replace(/^\n\n/, ""),
  //   });
  // };

  //   const handleMessageGroupSelect = (value: string) => {
  //     const messageGroup = messageGroupList.find((group) => group.messageStorageId === value);
  //     if (messageGroup) {
  //       setMessageGroup(messageGroup);
  //     }
  //   };

  //   const [isAddMessageGroupDialogOpen, setIsAddMessageGroupDialogOpen] = useState<boolean>(false);
  //   const [groupName, setGroupName] = useState<string>("");

  const messageGroupStore = useMessageGroupStore();
  const messageGroupList = messageGroupStore.groupList;

  //   const handleOpenDialog = () => {
  //   setIsAddMessageGroupDialogOpen(true);
  //   };

  //   const handleRemoveDialog = () => {
  //     setMessageGroup(messageGroupStore.removeGroup(messageGroup));
  //   };

  //   const handleCloseDialog = () => {
  //   setIsAddMessageGroupDialogOpen(false);
  //   setGroupName("");
  //   };

  //   const handleAddMessageGroupDlgConfirm = () => {
  //   const newMessageGroup: MessageGroup = {
  //     name: groupName,
  //     messageStorageId: "message-storage-" + groupName,
  //   };
  //   messageGroupStore.addGroup(newMessageGroup);
  //   setMessageGroup(newMessageGroup);
  //   handleCloseDialog();
  //   };

  //   const handleCancel = () => {
  //   handleCloseDialog();
  //   };

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
            {/* <Selector
              className="w-32"
              dataSource={messageGroupList.map((item) => ({ text: item.name, value: item.messageStorageId }))}
              value={messageGroup.messageStorageId}
              handleValueChanged={handleMessageGroupSelect}
            /> */}
            <div className="flex space-x-2 bg-black overflow-scroll">
              {messageGroupList.map((item: MessageGroup) => (
                <div
                  className={`flex bg-zinc-100 dark:bg-zinc-800 rounded-md p-2 ${
                    messageGroup.messageStorageId === item.messageStorageId ? "border border-white" : ""
                  }`}
                  key={item.messageStorageId}
                  onClick={() => {
                    setMessageGroup(item);
                  }}
                >
                  <div className="truncate">{item.name}</div>
                  <Icon.X
                    className="w-4 h-auto ml-1 cursor-pointer"
                    onClick={() => {
                      messageGroupStore.removeGroup(item);
                    }}
                  />
                </div>
              ))}
            </div>

            <button className="btn-text px-1 ml-1">
              <Icon.Plus
                className="w-4 h-auto"
                onClick={() => {
                  messageGroupStore.addGroup({
                    name: "new group",
                    messageStorageId: generateUUID(),
                  });
                  console.log(messageGroupStore.groupList);
                }}
              />
            </button>
            {/* <button className="btn-text px-1" onClick={handleRemoveDialog}>
              <Icon.Trash2 className="w-4 h-auto" />
            </button> */}
          </span>
        </div>

        <div className="dialog-content-container w-full">
          <Stack spacing={2} style={{ width: "100%" }}>
            {messageList.length == 0 && <div>Nothing here</div>}
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
