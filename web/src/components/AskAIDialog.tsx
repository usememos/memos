import { Button, FormControl, Input, Modal, ModalClose, ModalDialog, Stack, Textarea, Typography } from "@mui/joy";
import React, { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { useTranslation } from "react-i18next";
import * as api from "@/helpers/api";
import useLoading from "@/hooks/useLoading";
import { marked } from "@/labs/marked";
import { useMessageStore } from "@/store/zustand/message";
import { defaultMessageGroup, MessageGroup, useMessageGroupStore } from "@/store/zustand/message-group";
import Icon from "./Icon";
import { generateDialog } from "./Dialog";
import showSettingDialog from "./SettingDialog";
import Selector from "./kit/Selector";

type Props = DialogProps;

const AskAIDialog: React.FC<Props> = (props: Props) => {
  const { t } = useTranslation();
  const { destroy, hide } = props;
  const fetchingState = useLoading(false);
  const [messageGroup, setMessageGroup] = useState<MessageGroup>(defaultMessageGroup);
  const messageStore = useMessageStore(messageGroup)();
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

  const handleMessageGroupSelect = (value: string) => {
    const messageGroup = messageGroupList.find((group) => group.messageStorageId === value);
    if (messageGroup) {
      setMessageGroup(messageGroup);
    }
  };

  const [isAddMessageGroupDialogOpen, setIsAddMessageGroupDialogOpen] = useState<boolean>(false);
  const [groupName, setGroupName] = useState<string>("");

  const messageGroupStore = useMessageGroupStore();
  const messageGroupList = messageGroupStore.groupList;

  const handleOpenDialog = () => {
    setIsAddMessageGroupDialogOpen(true);
  };

  const handleRemoveDialog = () => {
    setMessageGroup(messageGroupStore.removeGroup(messageGroup));
  };

  const handleCloseDialog = () => {
    setIsAddMessageGroupDialogOpen(false);
    setGroupName("");
  };

  const handleAddMessageGroupDlgConfirm = () => {
    const newMessageGroup: MessageGroup = {
      name: groupName,
      messageStorageId: "message-storage-" + groupName,
    };
    messageGroupStore.addGroup(newMessageGroup);
    setMessageGroup(newMessageGroup);
    handleCloseDialog();
  };

  const handleCancel = () => {
    handleCloseDialog();
  };

  return (
    <>
      <div className="dialog-header-container">
        <p className="title-text flex flex-row items-center">
          <Icon.Bot className="mr-1 w-5 h-auto opacity-80" />
          <span className="mr-4">{t("ask-ai.title")}</span>
          <span className="flex flex-row justify-start items-center">
            <Selector
              className="w-32"
              dataSource={messageGroupList.map((item) => ({ text: item.name, value: item.messageStorageId }))}
              value={messageGroup.messageStorageId}
              handleValueChanged={handleMessageGroupSelect}
            />
            <button className="btn-text px-1 ml-1" onClick={handleOpenDialog}>
              <Icon.Plus className="w-4 h-auto" />
            </button>
            <button className="btn-text px-1" onClick={handleRemoveDialog}>
              <Icon.Trash2 className="w-4 h-auto" />
            </button>
          </span>
        </p>

        <Modal open={isAddMessageGroupDialogOpen} onClose={handleCloseDialog}>
          <ModalDialog aria-labelledby="basic-modal-dialog-title" sx={{ maxWidth: 500 }}>
            <ModalClose />
            <Typography id="basic-modal-dialog-title" component="h2">
              {t("ask-ai.create-message-group-title")}
            </Typography>
            <Stack spacing={2}>
              <FormControl>
                <Input
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  placeholder={t("ask-ai.label-message-group-name-title")}
                />
              </FormControl>
              <div className="w-full flex justify-end gap-x-2">
                <Button variant="plain" onClick={handleCancel}>
                  {t("common.cancel")}
                </Button>
                <Button onClick={handleAddMessageGroupDlgConfirm}>{t("common.confirm")}</Button>
              </div>
            </Stack>
          </ModalDialog>
        </Modal>
        <button className="btn close-btn" onClick={() => hide()}>
          <Icon.X />
        </button>
      </div>
      <div className="dialog-content-container !w-112 max-w-full">
        <Stack spacing={2} style={{ width: "100%" }}>
          {messageList.map((message, index) => (
            <div key={index} className="w-full flex flex-col justify-start items-start space-y-2">
              {message.role === "user" ? (
                <div className="w-full flex flex-row justify-end items-start pl-6">
                  <span className="word-break shadow rounded-lg rounded-tr-none px-3 py-2 opacity-80 bg-gray-100 dark:bg-zinc-700">
                    {message.content}
                  </span>
                </div>
              ) : (
                <div className="w-full flex flex-row justify-start items-start pr-8 space-x-2">
                  <Icon.Bot className="mt-2 shrink-0 mr-1 w-6 h-auto opacity-80" />
                  <div className="memo-content-wrapper !w-auto flex flex-col justify-start items-start shadow rounded-lg rounded-tl-none px-3 py-2 bg-gray-100 dark:bg-zinc-700">
                    <div className="memo-content-text">{marked(message.content)}</div>
                  </div>
                </div>
              )}
            </div>
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
    document.body.classList.add("overflow-hidden");
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
