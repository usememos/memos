import { Autocomplete, Button, Input, List, ListItem, Option, Select, Typography } from "@mui/joy";
import React, { useRef, useState } from "react";
import { toast } from "react-hot-toast";
import { useTranslate } from "@/utils/i18n";
import { useResourceStore } from "../store/module";
import { generateDialog } from "./Dialog";
import Icon from "./Icon";

const fileTypeAutocompleteOptions = ["image/*", "text/*", "audio/*", "video/*", "application/*"];

interface Props extends DialogProps {
  onCancel?: () => void;
  onConfirm?: (resourceList: Resource[]) => void;
}

type SelectedMode = "local-file" | "external-link" | "download-link";

interface State {
  selectedMode: SelectedMode;
  uploadingFlag: boolean;
}

const CreateResourceDialog: React.FC<Props> = (props: Props) => {
  const t = useTranslate();
  const { destroy, onCancel, onConfirm } = props;
  const resourceStore = useResourceStore();
  const [state, setState] = useState<State>({
    selectedMode: "local-file",
    uploadingFlag: false,
  });
  const [resourceCreate, setResourceCreate] = useState<ResourceCreate>({
    filename: "",
    externalLink: "",
    type: "",
    downloadToLocal: false,
  });
  const [fileList, setFileList] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleReorderFileList = (fileName: string, direction: "up" | "down") => {
    const fileIndex = fileList.findIndex((file) => file.name === fileName);
    if (fileIndex === -1) {
      return;
    }

    const newFileList = [...fileList];

    if (direction === "up") {
      if (fileIndex === 0) {
        return;
      }
      const temp = newFileList[fileIndex - 1];
      newFileList[fileIndex - 1] = newFileList[fileIndex];
      newFileList[fileIndex] = temp;
    } else if (direction === "down") {
      if (fileIndex === fileList.length - 1) {
        return;
      }
      const temp = newFileList[fileIndex + 1];
      newFileList[fileIndex + 1] = newFileList[fileIndex];
      newFileList[fileIndex] = temp;
    }

    setFileList(newFileList);
  };

  const handleCloseDialog = () => {
    if (onCancel) {
      onCancel();
    }
    destroy();
  };

  const handleSelectedModeChanged = (mode: "local-file" | "external-link" | "download-link") => {
    setState((state) => {
      return {
        ...state,
        selectedMode: mode,
      };
    });
  };

  const handleExternalLinkChanged = (event: React.ChangeEvent<HTMLInputElement>) => {
    const externalLink = event.target.value;
    setResourceCreate((state) => {
      return {
        ...state,
        externalLink,
      };
    });
  };

  const handleFileNameChanged = (event: React.ChangeEvent<HTMLInputElement>) => {
    const filename = event.target.value;
    setResourceCreate((state) => {
      return {
        ...state,
        filename,
      };
    });
  };

  const handleFileTypeChanged = (fileType: string) => {
    setResourceCreate((state) => {
      return {
        ...state,
        type: fileType,
      };
    });
  };

  const handleFileInputChange = async () => {
    if (!fileInputRef.current || !fileInputRef.current.files) {
      return;
    }

    const files: File[] = [];
    for (const file of fileInputRef.current.files) {
      files.push(file);
    }
    setFileList(files);
  };

  const allowConfirmAction = () => {
    if (state.selectedMode === "local-file") {
      if (!fileInputRef.current || !fileInputRef.current.files || fileInputRef.current.files.length === 0) {
        return false;
      }
    } else if (state.selectedMode === "external-link") {
      if (resourceCreate.filename === "" || resourceCreate.externalLink === "" || resourceCreate.type === "") {
        return false;
      }
    } else if (state.selectedMode === "download-link") {
      if (resourceCreate.externalLink === "") {
        return false;
      }
    }
    return true;
  };

  const handleConfirmBtnClick = async () => {
    if (state.uploadingFlag) {
      return;
    }

    setState((state) => {
      return {
        ...state,
        uploadingFlag: true,
      };
    });

    const createdResourceList: Resource[] = [];
    try {
      if (state.selectedMode === "local-file") {
        if (!fileInputRef.current || !fileInputRef.current.files) {
          return;
        }
        const filesOnInput = Array.from(fileInputRef.current.files);
        for (const file of fileList) {
          const fileOnInput = filesOnInput.find((fileOnInput) => fileOnInput.name === file.name);
          if (!fileOnInput) {
            continue;
          }
          const resource = await resourceStore.createResourceWithBlob(file);
          createdResourceList.push(resource);
        }
      } else {
        if (state.selectedMode === "download-link") {
          resourceCreate.downloadToLocal = true;
        }
        const resource = await resourceStore.createResource(resourceCreate);
        createdResourceList.push(resource);
      }
    } catch (error: any) {
      console.error(error);
      toast.error(typeof error === "string" ? error : error.response.data.message);
    }

    if (onConfirm) {
      onConfirm(createdResourceList);
    }
    destroy();
  };

  return (
    <>
      <div className="dialog-header-container">
        <p className="title-text">{t("resource.create-dialog.title")}</p>
        <button className="btn close-btn" onClick={handleCloseDialog}>
          <Icon.X />
        </button>
      </div>
      <div className="dialog-content-container !w-80">
        <Typography className="!mb-1" level="body2">
          {t("resource.create-dialog.upload-method")}
        </Typography>
        <Select
          className="w-full mb-2"
          onChange={(_, value) => handleSelectedModeChanged(value as SelectedMode)}
          value={state.selectedMode}
          startDecorator={<Icon.File className="w-4 h-auto" />}
        >
          <Option value="local-file">{t("resource.create-dialog.local-file.option")}</Option>
          <Option value="external-link">{t("resource.create-dialog.external-link.option")}</Option>
          <Option value="download-link">{t("resource.create-dialog.download-link.option")}</Option>
        </Select>

        {state.selectedMode === "local-file" && (
          <>
            <div className="w-full relative bg-blue-50 dark:bg-zinc-900 rounded-md flex flex-row justify-center items-center py-8">
              <label htmlFor="files" className="p-2 px-4 text-sm text-white cursor-pointer bg-blue-500 block rounded hover:opacity-80">
                {t("resource.create-dialog.local-file.choose")}
              </label>
              <input
                className="absolute inset-0 w-full h-full opacity-0"
                ref={fileInputRef}
                onChange={handleFileInputChange}
                type="file"
                id="files"
                multiple={true}
                accept="*"
              />
            </div>
            <List size="sm" sx={{ width: "100%" }}>
              {fileList.map((file, index) => (
                <ListItem key={file.name} className="flex justify-between">
                  <Typography noWrap>{file.name}</Typography>
                  <div className="flex gap-1">
                    <button
                      onClick={() => {
                        handleReorderFileList(file.name, "up");
                      }}
                      disabled={index === 0}
                      className="disabled:opacity-50"
                    >
                      <Icon.ArrowUp className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => {
                        handleReorderFileList(file.name, "down");
                      }}
                      disabled={index === fileList.length - 1}
                      className="disabled:opacity-50"
                    >
                      <Icon.ArrowDown className="w-4 h-4" />
                    </button>
                  </div>
                </ListItem>
              ))}
            </List>
          </>
        )}

        {state.selectedMode === "external-link" && (
          <>
            <Typography className="!mb-1" level="body2">
              {t("resource.create-dialog.external-link.link")}
            </Typography>
            <Input
              className="mb-2"
              placeholder={t("resource.create-dialog.external-link.link-placeholder")}
              value={resourceCreate.externalLink}
              onChange={handleExternalLinkChanged}
              fullWidth
            />
            <Typography className="!mb-1" level="body2">
              {t("resource.create-dialog.external-link.file-name")}
            </Typography>
            <Input
              className="mb-2"
              placeholder={t("resource.create-dialog.external-link.file-name-placeholder")}
              value={resourceCreate.filename}
              onChange={handleFileNameChanged}
              fullWidth
            />
            <Typography className="!mb-1" level="body2">
              {t("resource.create-dialog.external-link.type")}
            </Typography>
            <Autocomplete
              className="w-full"
              size="sm"
              placeholder={t("resource.create-dialog.external-link.type-placeholder")}
              freeSolo={true}
              options={fileTypeAutocompleteOptions}
              onChange={(_, value) => handleFileTypeChanged(value || "")}
            />
          </>
        )}

        {state.selectedMode === "download-link" && (
          <>
            <Typography className="!mb-1" level="body2">
              {t("resource.create-dialog.external-link.link")}
            </Typography>
            <Input
              className="mb-2"
              placeholder={t("resource.create-dialog.external-link.link-placeholder")}
              value={resourceCreate.externalLink}
              onChange={handleExternalLinkChanged}
              fullWidth
            />
          </>
        )}

        <div className="mt-2 w-full flex flex-row justify-end items-center space-x-1">
          <Button variant="plain" color="neutral" onClick={handleCloseDialog}>
            {t("common.cancel")}
          </Button>
          <Button onClick={handleConfirmBtnClick} loading={state.uploadingFlag} disabled={!allowConfirmAction()}>
            {t("common.create")}
          </Button>
        </div>
      </div>
    </>
  );
};

function showCreateResourceDialog(props: Omit<Props, "destroy" | "hide">) {
  generateDialog<Props>(
    {
      dialogName: "create-resource-dialog",
    },
    CreateResourceDialog,
    props
  );
}

export default showCreateResourceDialog;
