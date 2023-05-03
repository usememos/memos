import { useTranslation } from "react-i18next";
import { useEditorStore } from "@/store/module";
import Icon from "@/components/Icon";
import showCreateResourceDialog from "@/components/CreateResourceDialog";
import showResourcesSelectorDialog from "@/components/ResourcesSelectorDialog";

const ResourceSelector = () => {
  const { t } = useTranslation();
  const editorStore = useEditorStore();

  const handleUploadFileBtnClick = () => {
    showCreateResourceDialog({
      onConfirm: (resourceList) => {
        editorStore.setResourceList([...editorStore.state.resourceList, ...resourceList]);
      },
    });
  };

  return (
    <div className="action-btn relative group">
      <Icon.FileText className="icon-img" />
      <div className="hidden flex-col justify-start items-start absolute top-6 left-0 mt-1 p-1 z-1 rounded w-auto overflow-auto font-mono shadow bg-zinc-200 dark:bg-zinc-600 group-hover:flex">
        <div
          className="w-full flex text-black dark:text-gray-300 cursor-pointer rounded text-sm leading-6 px-2 truncate hover:bg-zinc-300 dark:hover:bg-zinc-700 shrink-0"
          onClick={handleUploadFileBtnClick}
        >
          <Icon.Plus className="w-4 mr-1" />
          <span>{t("common.create")}</span>
        </div>
        <div
          className="w-full flex text-black dark:text-gray-300 cursor-pointer rounded text-sm leading-6 px-2 truncate hover:bg-zinc-300 dark:hover:bg-zinc-700 shrink-0"
          onClick={showResourcesSelectorDialog}
        >
          <Icon.Database className="w-4 mr-1" />
          <span>{t("editor.resources")}</span>
        </div>
      </div>
    </div>
  );
};
export default ResourceSelector;
