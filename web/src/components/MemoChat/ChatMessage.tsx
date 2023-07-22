import { Message } from "@/store/zustand/message";
import { marked } from "@/labs/marked";
import Icon from "@/components/Icon";
import Dropdown from "../kit/Dropdown";
import { useMemoStore } from "@/store/module";
import toast from "react-hot-toast";
import { useTranslate } from "@/utils/i18n";

interface MessageProps {
  index: number;
  message: Message;
}

const ChatMessage = ({ index, message }: MessageProps) => {
  const memoStore = useMemoStore();
  const t = useTranslate();

  const handleSaveAsMemos = async () => {
    await memoStore.createMemo({
      content: message.content,
      visibility: "PRIVATE",
      resourceIdList: [],
      relationList: [],
    });
    toast.success(t("memo-chat.save-as-memo-success"));
  };

  return (
    <div key={index} className="w-full flex flex-col justify-start items-start space-y-2">
      {message.role === "user" ? (
        <div className="w-full flex flex-row justify-end items-start pl-6">
          <span className="word-break shadow rounded-lg rounded-tr-none px-3 py-2 opacity-80 bg-white dark:bg-zinc-800">
            {message.content}
          </span>
        </div>
      ) : (
        <div className="w-full flex flex-row justify-start items-start pr-8 space-x-2">
          <Icon.Bot className="mt-2 shrink-0 mr-1 w-6 h-auto opacity-80" />
          <div className="memo-content-wrapper !w-auto flex flex-col justify-start items-start shadow rounded-lg rounded-tl-none px-3 py-2 bg-white dark:bg-zinc-800">
            <div className="memo-content-text">{marked(message.content)}</div>
          </div>
          <Dropdown
            actions={
              <>
                <button
                  className="w-full m-auto text-left text-sm whitespace-nowrap leading-6 py-1 px-3 cursor-pointer rounded hover:bg-gray-100 dark:hover:bg-zinc-600"
                  onClick={() => handleSaveAsMemos()}
                >
                  {t("memo-chat.save-as-memo")}
                </button>
              </>
            }
          />
        </div>
      )}
    </div>
  );
};

export default ChatMessage;
