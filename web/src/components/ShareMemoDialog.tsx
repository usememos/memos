import { Button } from "@mui/joy";
import copy from "copy-to-clipboard";
import { QRCodeSVG } from "qrcode.react";
import React, { useEffect, useRef } from "react";
import { toast } from "react-hot-toast";
import { getDateTimeString } from "@/helpers/datetime";
import useLoading from "@/hooks/useLoading";
import toImage from "@/labs/html2image";
import { useUserV1Store } from "@/store/v1";
import { useTranslate } from "@/utils/i18n";
import { generateDialog } from "./Dialog";
import showEmbedMemoDialog from "./EmbedMemoDialog";
import Icon from "./Icon";
import MemoContent from "./MemoContent";
import MemoResourceListView from "./MemoResourceListView";
import UserAvatar from "./UserAvatar";
import "@/less/share-memo-dialog.less";

interface Props extends DialogProps {
  memo: Memo;
}

const ShareMemoDialog: React.FC<Props> = (props: Props) => {
  const { memo: propsMemo, destroy } = props;
  const t = useTranslate();
  const userV1Store = useUserV1Store();
  const downloadingImageState = useLoading(false);
  const loadingState = useLoading();
  const memoElRef = useRef<HTMLDivElement>(null);
  const memo = {
    ...propsMemo,
    displayTsStr: getDateTimeString(propsMemo.displayTs),
  };
  const user = userV1Store.getUserByUsername(memo.creatorUsername);

  useEffect(() => {
    (async () => {
      await userV1Store.getOrFetchUserByUsername(memo.creatorUsername);
      loadingState.setFinish();
    })();
  }, []);

  const handleCloseBtnClick = () => {
    destroy();
  };

  const handleDownloadImageBtnClick = () => {
    if (!memoElRef.current) {
      return;
    }

    downloadingImageState.setLoading();
    toImage(memoElRef.current, {
      pixelRatio: window.devicePixelRatio * 2,
    })
      .then((url) => {
        const a = document.createElement("a");
        a.href = url;
        a.download = `memos-${getDateTimeString(Date.now())}.png`;
        a.click();

        downloadingImageState.setFinish();
      })
      .catch((err) => {
        console.error(err);
      });
  };

  const handleShowEmbedMemoDialog = () => {
    showEmbedMemoDialog(memo.id);
  };

  const handleCopyLinkBtnClick = () => {
    copy(`${window.location.origin}/m/${memo.id}`);
    toast.success(t("message.succeed-copy-link"));
  };

  if (loadingState.isLoading) {
    return null;
  }

  return (
    <>
      <div className="dialog-header-container py-3 px-4 !mb-0 rounded-t-lg">
        <p className="">{t("common.share")} Memo</p>
        <button className="btn close-btn" onClick={handleCloseBtnClick}>
          <Icon.X className="icon-img" />
        </button>
      </div>
      <div className="dialog-content-container w-full flex flex-col justify-start items-start relative">
        <div className="px-4 pb-3 w-full flex flex-row justify-start items-center space-x-2">
          <Button color="neutral" variant="outlined" disabled={downloadingImageState.isLoading} onClick={handleDownloadImageBtnClick}>
            {downloadingImageState.isLoading ? (
              <Icon.Loader className="w-4 h-auto mr-1 animate-spin" />
            ) : (
              <Icon.Download className="w-4 h-auto mr-1" />
            )}
            {t("common.image")}
          </Button>
          <Button color="neutral" variant="outlined" onClick={handleShowEmbedMemoDialog}>
            <Icon.Code className="w-4 h-auto mr-1" />
            {t("memo.embed")}
          </Button>
          <Button color="neutral" variant="outlined" onClick={handleCopyLinkBtnClick}>
            <Icon.Link className="w-4 h-auto mr-1" />
            {t("common.link")}
          </Button>
        </div>
        <div className="w-full rounded-lg border-t overflow-clip">
          <div
            className="w-full h-auto select-none relative flex flex-col justify-start items-start bg-white dark:bg-zinc-800"
            ref={memoElRef}
          >
            <span className="w-full px-6 pt-5 pb-2 text-sm text-gray-500">{memo.displayTsStr}</span>
            <div className="w-full px-6 text-base pb-4">
              <MemoContent content={memo.content} />
              <MemoResourceListView className="!grid-cols-2" resourceList={memo.resourceList} />
            </div>
            <div className="flex flex-row justify-between items-center w-full bg-gray-100 dark:bg-zinc-700 py-4 px-6">
              <UserAvatar className="mr-2" avatarUrl={user.avatarUrl} />
              <div className="w-auto grow truncate flex mr-2 flex-col justify-center items-start">
                <span className="w-full text-sm truncate font-bold text-gray-600 dark:text-gray-300">{user.nickname || user.username}</span>
              </div>
              <QRCodeSVG
                value={`${window.location.origin}/m/${memo.id}`}
                size={28}
                bgColor={"#F3F4F6"}
                fgColor={"#4B5563"}
                includeMargin={false}
              />
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default function showShareMemoDialog(memo: Memo): void {
  generateDialog(
    {
      className: "share-memo-dialog",
      dialogName: "share-memo-dialog",
    },
    ShareMemoDialog,
    { memo }
  );
}
