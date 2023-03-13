import { Button } from "@mui/joy";
import copy from "copy-to-clipboard";
import { ReactElement, useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { useTranslation } from "react-i18next";
import useLoading from "../hooks/useLoading";
import { useResourceStore } from "../store/module";
import { getResourceUrl } from "../utils/resource";
import Icon from "./Icon";
import Dropdown from "./base/Dropdown";
import { remove } from "lodash-es";

import { generateDialog } from "./Dialog";
import { showCommonDialog } from "./Dialog/CommonDialog";
import showPreviewImageDialog from "./PreviewImageDialog";
import showCreateResourceDialog from "./CreateResourceDialog";
import showChangeResourceFilenameDialog from "./ChangeResourceFilenameDialog";
import "../less/resources-dialog.less";
import dayjs from "dayjs";

type Props = DialogProps;

interface FileProps {
  resouce: Resource;
  select: any;
  unselect: any;
  rename: any;
  deleteHandle: any;
}

function getFileCover(filename: string): ReactElement {
  switch (filename.split(".").pop()) {
    case "png":
      return <Icon.FileImage className="icon-cover" />;
    case "jpge":
      return <Icon.FileImage className="icon-cover" />;
    case "docx":
      return <Icon.FileText className="icon-cover" />;
    case "pdf":
      return <Icon.FileType2 className="icon-cover" />;
    case "doc":
      return <Icon.FileText className="icon-cover" />;
    default:
      return <Icon.FileImage className="icon-cover" />;
  }
}

const File = ({ resouce, select, unselect, rename, deleteHandle }: FileProps) => {
  const locale = "en";

  const [beSelect, setBeSelect] = useState(false);
  const cover = getFileCover(resouce.filename);
  const { t, _ } = useTranslation();

  return (
    <div
      className="resource-card"
      onClick={() => {
        if (beSelect) {
          unselect();
        } else {
          select();
        }

        setBeSelect(!beSelect);
      }}
    >
      <div className="btns-container">
        <span className="btn more-action-btn">
          <Icon.MoreHorizontal className="icon-img" />
        </span>
        <div className="more-action-btns-wrapper">
          <div className="more-action-btns-container">
            <span
              className="btn"
              onClick={() => {
                rename(resouce);
              }}
            >
              {"rename"}
            </span>
            <span
              className="btn"
              onClick={() => {
                deleteHandle(resouce);
              }}
            >
              {"delete"}
            </span>
          </div>
        </div>

        {beSelect ? <Icon.CheckCircle2 className="resource-checkbox-selected" /> : <Icon.Circle className="resource-checkbox" />}
      </div>
      {cover}
      <div>
        <div className="resource-title">{resouce.filename}</div>
        <div className="resource-time">{dayjs(resouce.createdTs).locale(locale).format("YYYY/MM/DD HH:mm:ss")}</div>
      </div>
    </div>
  );
};

const ResourcesDialog: React.FC<Props> = (props: Props) => {
  const { destroy } = props;
  const { t } = useTranslation();
  const loadingState = useLoading();
  const resourceStore = useResourceStore();
  const resources = resourceStore.state.resources;
  const [selectList, setSelectList] = useState<Array<Resource>>([]);

  useEffect(() => {
    resourceStore
      .fetchResourceList()
      .catch((error) => {
        console.error(error);
        toast.error(error.response.data.message);
      })
      .finally(() => {
        loadingState.setFinish();
      });
  }, []);

  const handleSelectBtnClick = (resource: Resource) => {
    // first click and second click?
    setSelectList([...selectList, resource]);
  };

  const handleUNSelectBtnClick = (resource: Resource) => {
    // first click and second click?
    setSelectList(
      remove(selectList, (res) => {
        res == resource;
      })
    );
  };

  const handlePreviewBtnClick = (resource: Resource) => {
    const resourceUrl = getResourceUrl(resource);
    if (resource.type.startsWith("image")) {
      showPreviewImageDialog(
        resources.filter((r) => r.type.startsWith("image")).map((r) => getResourceUrl(r)),
        resources.findIndex((r) => r.id === resource.id)
      );
    } else {
      window.open(resourceUrl);
    }
  };

  const handleRenameBtnClick = (resource: Resource) => {
    showChangeResourceFilenameDialog(resource.id, resource.filename);
  };

  const handleCopyResourceLinkBtnClick = (resource: Resource) => {
    const url = getResourceUrl(resource);
    copy(url);
    toast.success(t("message.succeed-copy-resource-link"));
  };

  const handleDeleteUnusedResourcesBtnClick = () => {
    let warningText = t("resources.warning-text-unused");
    const unusedResources = resources.filter((resource) => {
      if (resource.linkedMemoAmount === 0) {
        warningText = warningText + `\n- ${resource.filename}`;
        return true;
      }
      return false;
    });
    if (unusedResources.length === 0) {
      toast.success(t("resources.no-unused-resources"));
      return;
    }
    showCommonDialog({
      title: t("resources.delete-resource"),
      content: warningText,
      style: "warning",
      dialogName: "delete-unused-resources",
      onConfirm: async () => {
        for (const resource of unusedResources) {
          await resourceStore.deleteResourceById(resource.id);
        }
      },
    });
  };

  const handleDeleteResourceBtnClick = (resource: Resource) => {
    let warningText = t("resources.warning-text");
    if (resource.linkedMemoAmount > 0) {
      warningText = warningText + `\n${t("resources.linked-amount")}: ${resource.linkedMemoAmount}`;
    }

    showCommonDialog({
      title: t("resources.delete-resource"),
      content: warningText,
      style: "warning",
      dialogName: "delete-resource-dialog",
      onConfirm: async () => {
        await resourceStore.deleteResourceById(resource.id);
      },
    });
  };

  const handleUnSelectBtnClick = () => {
    setSelectList([]);
  };

  const handleDeleteSelectedBtnClick = () => {
    const warningText = t("resources.warning-text");

    showCommonDialog({
      title: t("resources.delete-resource"),
      content: warningText,
      style: "warning",
      dialogName: "delete-resource-dialog",
      onConfirm: async () => {
        selectList.map(async (resource: Resource) => {
          await resourceStore.deleteResourceById(resource.id);
        });
      },
    });
  };

  return (
    <>
      <div className="dialog-header-container">
        <p className="title-text">{t("common.resources")}</p>
        <button className="btn close-btn" onClick={destroy}>
          <Icon.X className="icon-img" />
        </button>
      </div>
      <div className="dialog-content-container">
        <div className="w-full flex flex-row justify-between items-center">
          <div className="flex flex-row justify-start items-center space-x-2">
            <Button onClick={() => showCreateResourceDialog({})} startDecorator={<Icon.Plus className="w-5 h-auto" />}>
              {t("common.create")}
            </Button>

            <Button onClick={() => handleDeleteSelectedBtnClick()} color="danger" startDecorator={<Icon.Trash2 className="w-4 h-auto" />}>
              {"删除所选资源"}
            </Button>
          </div>
          <div className="flex flex-row justify-end items-center">
            <Button color="danger" onClick={handleDeleteUnusedResourcesBtnClick} startDecorator={<Icon.Trash2 className="w-4 h-auto" />}>
              <span>{t("resources.clear")}</span>
            </Button>
          </div>
        </div>
        {loadingState.isLoading ? (
          <div className="loading-text-container">
            <p className="tip-text">{t("resources.fetching-data")}</p>
          </div>
        ) : (
          <div className="resource-table-container">
            {resources.length === 0 ? (
              <p className="tip-text">{t("resources.no-resources")}</p>
            ) : (
              resources.map((resource) => (
                <File
                  key={resource.id}
                  resouce={resource}
                  select={() => handleSelectBtnClick(resource)}
                  unselect={() => handleUNSelectBtnClick(resource)}
                  rename={handleRenameBtnClick}
                  deleteHandle={handleDeleteResourceBtnClick}
                ></File>
              ))
            )}
          </div>
        )}
      </div>
    </>
  );
};

export default function showResourcesDialog() {
  generateDialog(
    {
      className: "resources-dialog",
      dialogName: "resources-dialog",
    },
    ResourcesDialog,
    {}
  );
}
