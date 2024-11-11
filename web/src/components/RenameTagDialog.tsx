import { List, ListItem } from "@mui/joy";
import { Button, Input } from "@usememos/mui";
import { XIcon } from "lucide-react";
import React, { useState } from "react";
import { toast } from "react-hot-toast";
import { memoServiceClient } from "@/grpcweb";
import useCurrentUser from "@/hooks/useCurrentUser";
import useLoading from "@/hooks/useLoading";
import { useMemoMetadataStore } from "@/store/v1";
import { useTranslate } from "@/utils/i18n";
import { generateDialog } from "./Dialog";

interface Props extends DialogProps {
  tag: string;
}

const RenameTagDialog: React.FC<Props> = (props: Props) => {
  const { tag, destroy } = props;
  const t = useTranslate();
  const memoMetadataStore = useMemoMetadataStore();
  const [newName, setNewName] = useState(tag);
  const requestState = useLoading(false);
  const user = useCurrentUser();

  const handleTagNameInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewName(e.target.value.trim());
  };

  const handleConfirm = async () => {
    if (!newName || newName.includes(" ")) {
      toast.error("Tag name cannot be empty or contain spaces");
      return;
    }
    if (newName === tag) {
      toast.error("New name cannot be the same as the old name");
      return;
    }

    try {
      await memoServiceClient.renameMemoTag({
        parent: "memos/-",
        oldTag: tag,
        newTag: newName,
      });
      toast.success("Rename tag successfully");
      memoMetadataStore.fetchMemoMetadata({ user });
    } catch (error: any) {
      console.error(error);
      toast.error(error.details);
    }
    destroy();
  };

  return (
    <>
      <div className="dialog-header-container">
        <p className="title-text">{"Rename tag"}</p>
        <Button size="sm" variant="plain" onClick={() => destroy()}>
          <XIcon className="w-5 h-auto" />
        </Button>
      </div>
      <div className="dialog-content-container max-w-xs">
        <div className="w-full flex flex-col justify-start items-start mb-3">
          <div className="relative w-full mb-2 flex flex-row justify-start items-center space-x-2">
            <span className="w-20 text-sm whitespace-nowrap shrink-0 text-right">Old Name</span>
            <Input className="w-full" readOnly disabled type="text" placeholder="A new tag name" value={tag} />
          </div>
          <div className="relative w-full mb-2 flex flex-row justify-start items-center space-x-2">
            <span className="w-20 text-sm whitespace-nowrap shrink-0 text-right">New Name</span>
            <Input className="w-full" type="text" placeholder="A new tag name" value={newName} onChange={handleTagNameInputChange} />
          </div>
          <List size="sm" marker="disc">
            <ListItem>
              <p className="leading-5">All your memos with this tag will be updated.</p>
            </ListItem>
          </List>
        </div>
        <div className="w-full flex flex-row justify-end items-center space-x-2">
          <Button variant="plain" disabled={requestState.isLoading} onClick={destroy}>
            {t("common.cancel")}
          </Button>
          <Button color="primary" disabled={requestState.isLoading} onClick={handleConfirm}>
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
    props,
  );
}

export default showRenameTagDialog;
