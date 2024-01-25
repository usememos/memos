import { Button, IconButton, Input, List, ListItem } from "@mui/joy";
import React, { useState } from "react";
import { toast } from "react-hot-toast";
import { tagServiceClient } from "@/grpcweb";
import useCurrentUser from "@/hooks/useCurrentUser";
import useLoading from "@/hooks/useLoading";
import { useTranslate } from "@/utils/i18n";
import { generateDialog } from "./Dialog";
import Icon from "./Icon";

interface Props extends DialogProps {
  tag: string;
}

const RenameTagDialog: React.FC<Props> = (props: Props) => {
  const { tag, destroy } = props;
  const t = useTranslate();
  const currentUser = useCurrentUser();
  const [newName, setNewName] = useState(tag);
  const requestState = useLoading(false);

  const handleTagNameInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewName(e.target.value.trim());
  };

  const handleConfirm = async () => {
    if (!newName) {
      toast.error("Please fill all required fields");
      return;
    }
    if (newName === tag) {
      toast.error("New name cannot be the same as the old name");
      return;
    }

    try {
      await tagServiceClient.renameTag({
        user: currentUser.name,
        oldName: tag,
        newName: newName,
      });
      toast.success("Rename tag successfully");
      setTimeout(() => {
        window.location.reload();
      }, 300);
    } catch (error: any) {
      console.error(error);
      toast.error(error.details);
    }
  };

  return (
    <>
      <div className="dialog-header-container">
        <p className="title-text">{"Rename tag"}</p>
        <IconButton size="sm" onClick={() => destroy()}>
          <Icon.X className="w-5 h-auto" />
        </IconButton>
      </div>
      <div className="dialog-content-container max-w-xs">
        <div className="w-full flex flex-col justify-start items-start mb-3">
          <div className="relative w-full mb-2 flex flex-row justify-start items-center space-x-2">
            <span className="w-20 text-sm whitespace-nowrap shrink-0 text-right">Old Name</span>
            <Input className="w-full" readOnly disabled type="text" placeholder="A new tag name" size="md" value={tag} />
          </div>
          <div className="relative w-full mb-2 flex flex-row justify-start items-center space-x-2">
            <span className="w-20 text-sm whitespace-nowrap shrink-0 text-right">New Name</span>
            <Input
              className="w-full"
              type="text"
              placeholder="A new tag name"
              size="md"
              value={newName}
              onChange={handleTagNameInputChange}
            />
          </div>
          <List className="!leading-5" size="sm" marker="disc">
            <ListItem>All memes with this tag will be updated.</ListItem>
            <ListItem>If the amount of data is large, it will take longer and the server load will become higher.</ListItem>
            <ListItem>The page will be automatically refreshed when the task is completed</ListItem>
          </List>
        </div>
        <div className="w-full flex flex-row justify-end items-center mt-2 space-x-2">
          <Button color="neutral" variant="plain" disabled={requestState.isLoading} loading={requestState.isLoading} onClick={destroy}>
            {t("common.cancel")}
          </Button>
          <Button color="primary" disabled={requestState.isLoading} loading={requestState.isLoading} onClick={handleConfirm}>
            {t("common.confirm")}
          </Button>
        </div>
      </div>
    </>
  );
};

function showRenameTagDialog(props: Pick<Props, "tag">) {
  generateDialog(
    {
      className: "rename-tag-dialog",
      dialogName: "rename-tag-dialog",
    },
    RenameTagDialog,
    props
  );
}

export default showRenameTagDialog;
