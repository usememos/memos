import Icon from "@/components/Icon";
import Textarea from "@mui/joy/Textarea/Textarea";
import { useTranslation } from "react-i18next";

interface Props {
  question: string;
  handleQuestionTextareaChange: any;
  setIsInIME: any;
  handleKeyDown: any;
  handleSendQuestionButtonClick: any;
}

const ChatInput = ({ question, handleQuestionTextareaChange, setIsInIME, handleKeyDown, handleSendQuestionButtonClick }: Props) => {
  const { t } = useTranslation();

  return (
    <div className="w-full relative mt-4">
      <Textarea
        className="w-full"
        placeholder={t("memo-chat.placeholder")}
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
  );
};

export default ChatInput;
