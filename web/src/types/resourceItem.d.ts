interface ResourceProps {
  resource: Resource;
  handleCheckClick: () => void;
  handleUncheckClick: () => void;
  handleRenameBtnClick: (resource: Resource) => void;
  handleDeleteResourceBtnClick: (resource: Resource) => void;
  handlePreviewBtnClick: (resource: Resource) => void;
  handleCopyResourceLinkBtnClick: (resource: Resource) => void;
}

type ResourceItemType = ResourceProps;
