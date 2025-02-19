import { Dropdown, Menu, MenuButton, MenuItem, Tooltip } from "@mui/joy";
import EmojiRegex from "emoji-regex";
import { Edit3Icon, MoreVerticalIcon, TrashIcon, PlusIcon } from "lucide-react";
import { observer } from "mobx-react-lite";
import { userServiceClient } from "@/grpcweb";
import useAsyncEffect from "@/hooks/useAsyncEffect";
import useCurrentUser from "@/hooks/useCurrentUser";
import { useMemoFilterStore } from "@/store/v1";
import { userStore } from "@/store/v2";
import { Shortcut } from "@/types/proto/api/v1/user_service";
import { cn } from "@/utils";
import { useTranslate } from "@/utils/i18n";
import showCreateShortcutDialog from "../CreateShortcutDialog";

const emojiRegex = EmojiRegex();

const ShortcutsSection = observer(() => {
  const t = useTranslate();
  const user = useCurrentUser();
  const memoFilterStore = useMemoFilterStore();
  const shortcuts = userStore.state.shortcuts;

  useAsyncEffect(async () => {
    await userStore.fetchShortcuts();
  }, []);

  const handleDeleteShortcut = async (shortcut: Shortcut) => {
    const confirmed = window.confirm("Are you sure you want to delete this shortcut?");
    if (confirmed) {
      await userServiceClient.deleteShortcut({ parent: user.name, id: shortcut.id });
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
          const selected = memoFilterStore.shortcut === shortcut.id;
          const maybeEmoji = shortcut.title.split(" ")[0];
          const emoji = emojiRegex.test(maybeEmoji) ? maybeEmoji : undefined;
          const title = emoji ? shortcut.title.replace(emoji, "") : shortcut.title;
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
              <Dropdown>
                <MenuButton slots={{ root: "div" }}>
                  <MoreVerticalIcon className="w-4 h-auto shrink-0 opacity-40" />
                </MenuButton>
                <Menu size="sm" placement="bottom-start">
                  <MenuItem onClick={() => showCreateShortcutDialog({ shortcut })}>
                    <Edit3Icon className="w-4 h-auto" />
                    {t("common.edit")}
                  </MenuItem>
                  <MenuItem color="danger" onClick={() => handleDeleteShortcut(shortcut)}>
                    <TrashIcon className="w-4 h-auto" />
                    {t("common.delete")}
                  </MenuItem>
                </Menu>
              </Dropdown>
            </div>
          );
        })}
      </div>
    </div>
  );
});

export default ShortcutsSection;
