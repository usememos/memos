import { Button, Input, Select, Option, Typography, List, ListItem, Autocomplete } from "@mui/joy";
import React, { useRef, useState } from "react";
import { useResourceStore } from "../store/module";
import Icon from "./Icon";
import toastHelper from "./Toast";
import { generateDialog } from "./Dialog";

const fileTypeAutocompleteOptions = ["image/*", "text/*", "audio/*", "video/*", "application/*"];

interface Props extends DialogProps {
  onCancel?: () => void;
  onConfirm?: (resourceList: Resource[]) => void;
}

type SelectedMode = "local-file" | "external-link";

interface State {
  selectedMode: SelectedMode;
  uploadingFlag: boolean;
}

const CreateResourceDialog: React.FC<Props> = (props: Props) => {
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
  });
  const [fileList, setFileList] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleCloseDialog = () => {
    if (onCancel) {
      onCancel();
    }
    destroy();
  };

  const handleSelectedModeChanged = (mode: "local-file" | "external-link") => {
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
        for (const file of fileInputRef.current.files) {
          const resource = await resourceStore.createResourceWithBlob(file);
          createdResourceList.push(resource);
        }
      } else {
        const resource = await resourceStore.createResource(resourceCreate);
        createdResourceList.push(resource);
      }
    } catch (error: any) {
      console.error(error);
      toastHelper.error(error.response.data.message);
    }

    if (onConfirm) {
      onConfirm(createdResourceList);
    }
    destroy();
  };

  return (
    <>
      <div className="dialog-header-container">
        <p className="title-text">Create Resource</p>
        <button className="btn close-btn" onClick={handleCloseDialog}>
          <Icon.X />
        </button>
      </div>
      <div className="dialog-content-container !w-80">
        <Typography className="!mb-1" level="body2">
          Upload method
        </Typography>
        <Select
          className="w-full mb-2"
          onChange={(_, value) => handleSelectedModeChanged(value as SelectedMode)}
          value={state.selectedMode}
          startDecorator={<Icon.File className="w-4 h-auto" />}
        >
          <Option value="local-file">Local file</Option>
          <Option value="external-link">External link</Option>
        </Select>

        {state.selectedMode === "local-file" && (
          <>
            <div className="w-full relative bg-blue-50 rounded-md flex flex-row justify-center items-center py-8">
              <label htmlFor="files" className="p-2 px-4 text-sm text-white cursor-pointer bg-blue-500 block rounded hover:opacity-80">
                Choose a file...
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
            <List size="sm">
              {fileList.map((file) => (
                <ListItem key={file.name}>{file.name}</ListItem>
              ))}
            </List>
          </>
        )}

        {state.selectedMode === "external-link" && (
          <>
            <Typography className="!mb-1" level="body2">
              Link
            </Typography>
            <Input
              className="mb-2"
              placeholder="https://the.link.to/your/resource"
              value={resourceCreate.externalLink}
              onChange={handleExternalLinkChanged}
              fullWidth
            />
            <Typography className="!mb-1" level="body2">
              File name
            </Typography>
            <Input className="mb-2" placeholder="File name" value={resourceCreate.filename} onChange={handleFileNameChanged} fullWidth />
            <Typography className="!mb-1" level="body2">
              Type
            </Typography>
            <Autocomplete
              className="w-full"
              size="sm"
              placeholder="File type"
              freeSolo={true}
              options={fileTypeAutocompleteOptions}
              onChange={(_, value) => handleFileTypeChanged(value || "")}
            />
          </>
        )}

        <div className="mt-2 w-full flex flex-row justify-end items-center space-x-1">
          <Button variant="plain" color="neutral" onClick={handleCloseDialog}>
            Cancel
          </Button>
          <Button onClick={handleConfirmBtnClick} loading={state.uploadingFlag} disabled={!allowConfirmAction()}>
            Create
          </Button>
        </div>
      </div>
    </>
  );
};

function showCreateResourceDialog(props: Omit<Props, "destroy">) {
  generateDialog<Props>(
    {
      dialogName: "create-resource-dialog",
    },
    CreateResourceDialog,
    props
  );
}

export default showCreateResourceDialog;
