import { Input, Textarea } from "@mui/joy";
import { Button } from "@usememos/mui";
import { XIcon } from "lucide-react";
import React, { useState } from "react";
import { toast } from "react-hot-toast";
import { userServiceClient } from "@/grpcweb";
import useCurrentUser from "@/hooks/useCurrentUser";
import useLoading from "@/hooks/useLoading";
import { userStore } from "@/store/v2";
import { Shortcut } from "@/types/proto/api/v1/user_service";
import { useTranslate } from "@/utils/i18n";
import { generateUUID } from "@/utils/uuid";
import { generateDialog } from "./Dialog";

interface Props extends DialogProps {
  shortcut?: Shortcut;
}

const CreateShortcutDialog: React.FC<Props> = (props: Props) => {
  const { destroy } = props;
  const t = useTranslate();
  const user = useCurrentUser();
  const [shortcut, setShortcut] = useState(Shortcut.fromPartial({ ...props.shortcut }));
  const requestState = useLoading(false);
  const isCreating = !props.shortcut;

  const onShortcutTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setShortcut({ ...shortcut, title: e.target.value });
  };

  const onShortcutFilterChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setShortcut({ ...shortcut, filter: e.target.value });
  };

  const handleConfirm = async () => {
    if (!shortcut.title || !shortcut.filter) {
      toast.error("Title and filter cannot be empty");
      return;
    }

    try {
      if (isCreating) {
        await userServiceClient.createShortcut({
          parent: user.name,
          shortcut: {
            ...shortcut,
            id: generateUUID(),
          },
        });
        toast.success("Create shortcut successfully");
      } else {
        await userServiceClient.updateShortcut({ parent: user.name, shortcut, updateMask: ["title", "filter"] });
        toast.success("Update shortcut successfully");
      }
      // Refresh shortcuts.
      await userStore.fetchShortcuts();
      destroy();
    } catch (error: any) {
      console.error(error);
      toast.error(error.details);
    }
  };

  return (
    <div className="max-w-full shadow flex flex-col justify-start items-start bg-white dark:bg-zinc-800 dark:text-gray-300 p-4 rounded-lg">
      <div className="flex flex-row justify-between items-center mb-4 gap-2 w-full">
        <p className="title-text">{`${isCreating ? t("common.create") : t("common.edit")} ${t("common.shortcuts")}`}</p>
        <Button size="sm" variant="plain" onClick={() => destroy()}>
          <XIcon className="w-5 h-auto" />
        </Button>
      </div>
      <div className="flex flex-col justify-start items-start max-w-md min-w-72">
        <div className="w-full flex flex-col justify-start items-start mb-3">
          <span className="text-sm whitespace-nowrap mb-1">{t("common.title")}</span>
          <Input className="w-full" type="text" placeholder="" value={shortcut.title} onChange={onShortcutTitleChange} />
          <span className="text-sm whitespace-nowrap mt-3 mb-1">{t("common.filter")}</span>
          <Textarea
            className="w-full"
            minRows={3}
            maxRows={5}
            size="sm"
            placeholder={t("common.shortcut-filter")}
            value={shortcut.filter}
            onChange={onShortcutFilterChange}
          />
        </div>
        <div className="w-full opacity-70">
          <p className="text-sm">{t("common.learn-more")}:</p>
          <ul className="list-disc list-inside text-sm pl-2 mt-1">
            <li>
              <a
                className="text-sm text-blue-600 hover:underline"
                href="https://www.usememos.com/docs/getting-started/shortcuts"
                target="_blank"
              >
                Docs - Shortcuts
              </a>
            </li>
            <li>
              <a
                className="text-sm text-blue-600 hover:underline"
                href="https://www.usememos.com/docs/getting-started/shortcuts#how-to-write-a-filter"
                target="_blank"
              >
                How to Write a Filter?
              </a>
            </li>
          </ul>
        </div>
        <div className="w-full flex flex-row justify-end items-center space-x-2 mt-2">
          <Button variant="plain" disabled={requestState.isLoading} onClick={destroy}>
            {t("common.cancel")}
          </Button>
          <Button color="primary" disabled={requestState.isLoading} onClick={handleConfirm}>
            {t("common.confirm")}
          </Button>
        </div>
      </div>
    </div>
  );
};

function showCreateShortcutDialog(props: Pick<Props, "shortcut">) {
  generateDialog(
    {
      className: "create-shortcut-dialog",
      dialogName: "create-shortcut-dialog",
    },
    CreateShortcutDialog,
    props,
  );
}

export default showCreateShortcutDialog;
