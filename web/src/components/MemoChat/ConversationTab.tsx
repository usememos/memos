import { Conversation } from "@/store/v1/conversation";
import Icon from "@/components/Icon";

interface ConversationTabProps {
  item: Conversation;
  selectedConversationId: string;
  setSelectedConversationId: (id: string) => void;
  closeConversation: (e: any) => void;
}

const ConversationTab = ({ item, selectedConversationId, setSelectedConversationId, closeConversation }: ConversationTabProps) => {
  return (
    <div
      className={`flex rounded-lg h-8 px-3 cursor-pointer border dark:border-zinc-600 ${
        selectedConversationId === item.messageStorageId ? "bg-white dark:bg-zinc-700" : "bg-gray-200 dark:bg-zinc-800 opacity-60"
      }`}
      key={item.messageStorageId}
      onClick={() => {
        setSelectedConversationId(item.messageStorageId);
      }}
    >
      <div className="truncate m-auto">{item.name}</div>
      <Icon.X
        className="ml-1 w-4 h-auto m-auto cursor-pointer opacity-60"
        onClick={(e: any) => {
          closeConversation(e);
        }}
      />
    </div>
  );
};

export default ConversationTab;
