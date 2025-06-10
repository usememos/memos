import { Tooltip } from "@mui/joy";
import { Edit3Icon, MoreVerticalIcon, TrashIcon, PlusIcon } from "lucide-react";
import { observer } from "mobx-react-lite";
import { shortcutServiceClient } from "@/grpcweb";
import useAsyncEffect from "@/hooks/useAsyncEffect";
import useCurrentUser from "@/hooks/useCurrentUser";
import { userStore } from "@/store/v2";
import memoFilterStore from "@/store/v2/memoFilter";
import { Shortcut } from "@/types/proto/api/v1/shortcut_service";
import { cn } from "@/utils";
import { useTranslate } from "@/utils/i18n";
import showCreateShortcutDialog from "../CreateShortcutDialog";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/Popover";

const emojiRegex = /^(\p{Emoji_Presentation}|\p{Emoji}\uFE0F)$/u;

const ShortcutsSection = observer(() => {
  const t = useTranslate();
  const user = useCurrentUser();
  const shortcuts = userStore.state.shortcuts;

  useAsyncEffect(async () => {
    await userStore.fetchShortcuts();
  }, []);

  const handleDeleteShortcut = async (shortcut: Shortcut) => {
    const confirmed = window.confirm("Are you sure you want to delete this shortcut?");
    if (confirmed) {
      await shortcutServiceClient.deleteShortcut({ parent: user.name, id: shortcut.id });
      await userStore.fetchShortcuts();
    }
  };

  return (
    <div className="w-full flex flex-col justify-start items-start mt-3 px-1 h-auto shrink-0 flex-nowrap hide-scrollbar">
      <div className="flex flex-row justify-between items-center w-full gap-1 mb-1 text-sm leading-6 text-gray-400 select-none">
        <span>{t("common.shortcuts")}</span>
        <Tooltip title={t("common.create")} placement="top">
          <PlusIcon className="w-4 h-auto" onClick={() => showCreateShortcutDialog({})} />
        </Tooltip>
      </div>
      <div className="w-full flex flex-row justify-start items-center relative flex-wrap gap-x-2 gap-y-1">
        {shortcuts.map((shortcut) => {
          const maybeEmoji = shortcut.title.split(" ")[0];
          const emoji = emojiRegex.test(maybeEmoji) ? maybeEmoji : undefined;
          const title = emoji ? shortcut.title.replace(emoji, "") : shortcut.title;
          const selected = memoFilterStore.shortcut === shortcut.id;
          return (
            <div
              key={shortcut.id}
              className="shrink-0 w-full text-sm rounded-md leading-6 flex flex-row justify-between items-center select-none gap-2 text-gray-600 dark:text-gray-400 dark:border-zinc-800"
            >
              <span
                className={cn("truncate cursor-pointer dark:opacity-80", selected && "text-primary font-medium")}
                onClick={() => (selected ? memoFilterStore.setShortcut(undefined) : memoFilterStore.setShortcut(shortcut.id))}
              >
                {emoji && <span className="text-base mr-1">{emoji}</span>}
                {title.trim()}
              </span>
              <Popover>
                <PopoverTrigger asChild>
                  <MoreVerticalIcon className="w-4 h-auto shrink-0 opacity-40 cursor-pointer hover:opacity-70" />
                </PopoverTrigger>
                <PopoverContent align="end" alignOffset={-12}>
                  <div className="flex flex-col text-sm gap-0.5">
                    <button
                      onClick={() => showCreateShortcutDialog({ shortcut })}
                      className="flex items-center gap-2 px-2 py-1 text-left dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-700 outline-none rounded"
                    >
                      <Edit3Icon className="w-4 h-auto" />
                      {t("common.edit")}
                    </button>
                    <button
                      onClick={() => handleDeleteShortcut(shortcut)}
                      className="flex items-center gap-2 px-2 py-1 text-left text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-zinc-700 outline-none rounded"
                    >
                      <TrashIcon className="w-4 h-auto" />
                      {t("common.delete")}
                    </button>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          );
        })}
      </div>
    </div>
  );
});

export default ShortcutsSection;
