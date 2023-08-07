import { Option, Select } from "@mui/joy";
import copy from "copy-to-clipboard";
import { toLower } from "lodash-es";
import { QRCodeSVG } from "qrcode.react";
import React, { useEffect, useRef, useState } from "react";
import { toast } from "react-hot-toast";
import { getMemoStats } from "@/helpers/api";
import { VISIBILITY_SELECTOR_ITEMS } from "@/helpers/consts";
import { getDateTimeString, getTimeStampByDate } from "@/helpers/datetime";
import useLoading from "@/hooks/useLoading";
import toImage from "@/labs/html2image";
import { useMemoStore, useUserStore } from "@/store/module";
import { useTranslate } from "@/utils/i18n";
import { generateDialog } from "./Dialog";
import showEmbedMemoDialog from "./EmbedMemoDialog";
import Icon from "./Icon";
import MemoContent from "./MemoContent";
import MemoResourceListView from "./MemoResourceListView";
import "@/less/share-memo-dialog.less";

interface Props extends DialogProps {
  memo: Memo;
}

interface State {
  memoAmount: number;
  memoVisibility: Visibility;
  showQRCode: boolean;
}

const ShareMemoDialog: React.FC<Props> = (props: Props) => {
  const { memo: propsMemo, destroy } = props;
  const t = useTranslate();
  const userStore = useUserStore();
  const memoStore = useMemoStore();
  const user = userStore.state.user as User;
  const [state, setState] = useState<State>({
    memoAmount: 0,
    memoVisibility: propsMemo.visibility,
    showQRCode: true,
  });
  const createLoadingState = useLoading(false);
  const loadingState = useLoading();
  const memoElRef = useRef<HTMLDivElement>(null);
  const memo = {
    ...propsMemo,
    displayTsStr: getDateTimeString(propsMemo.displayTs),
  };
  const createdDays = Math.ceil((Date.now() - getTimeStampByDate(user.createdTs)) / 1000 / 3600 / 24);

  useEffect(() => {
    getMemoStats(user.username)
      .then(({ data }) => {
        setPartialState({
          memoAmount: data.length,
        });
        loadingState.setFinish();
      })
      .catch((error) => {
        console.error(error);
      });
  }, []);

  const setPartialState = (partialState: Partial<State>) => {
    setState({
      ...state,
      ...partialState,
    });
  };

  const handleCloseBtnClick = () => {
    destroy();
  };

  const handleDownloadBtnClick = () => {
    if (!memoElRef.current) {
      return;
    }

    createLoadingState.setLoading();

    toImage(memoElRef.current, {
      pixelRatio: window.devicePixelRatio * 2,
    })
      .then((url) => {
        const a = document.createElement("a");
        a.href = url;
        a.download = `memos-${getDateTimeString(Date.now())}.png`;
        a.click();

        createLoadingState.setFinish();
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

  const memoVisibilityOptionSelectorItems = VISIBILITY_SELECTOR_ITEMS.map((item) => {
    return {
      value: item.value,
      text: t(`memo.visibility.${toLower(item.value) as Lowercase<typeof item.value>}`),
    };
  });

  const handleMemoVisibilityOptionChanged = async (value: string) => {
    const visibilityValue = value as Visibility;
    setPartialState({
      memoVisibility: visibilityValue,
    });
    await memoStore.patchMemo({
      id: memo.id,
      visibility: visibilityValue,
    });
  };

  return (
    <>
      <div className="dialog-header-container py-3 px-4 !mb-0 rounded-t-lg">
        <p className="">{t("common.share")} Memo</p>
        <button className="btn close-btn" onClick={handleCloseBtnClick}>
          <Icon.X className="icon-img" />
        </button>
      </div>
      <div className="dialog-content-container w-full flex flex-col justify-start items-start relative">
        <div className="px-4 pb-3 w-full flex flex-row justify-start items-center">
          <span className="text-sm mr-2">{t("common.visibility")}:</span>
          <Select
            className="!min-w-[10rem] w-auto text-sm"
            value={state.memoVisibility}
            onChange={(_, visibility) => {
              if (visibility) {
                handleMemoVisibilityOptionChanged(visibility);
              }
            }}
          >
            {memoVisibilityOptionSelectorItems.map((item) => (
              <Option key={item.value} value={item.value} className="whitespace-nowrap">
                {item.text}
              </Option>
            ))}
          </Select>
        </div>
        <div className="px-4 pb-3 w-full flex flex-row justify-start items-center space-x-2">
          <button disabled={createLoadingState.isLoading} className="btn-normal h-8" onClick={handleDownloadBtnClick}>
            {createLoadingState.isLoading ? (
              <Icon.Loader className="w-4 h-auto mr-1 animate-spin" />
            ) : (
              <Icon.Download className="w-4 h-auto mr-1" />
            )}
            {t("common.image")}
          </button>
          <button className="btn-normal h-8" onClick={handleShowEmbedMemoDialog}>
            <Icon.Code className="w-4 h-auto mr-1" />
            {t("memo.embed")}
          </button>
          <button className="btn-normal h-8" onClick={handleCopyLinkBtnClick}>
            <Icon.Link className="w-4 h-auto mr-1" />
            {t("common.link")}
          </button>
        </div>
        <div className="w-full rounded-lg border-t overflow-clip">
          <div
            className="w-full h-auto select-none relative flex flex-col justify-start items-start bg-white dark:bg-zinc-800"
            ref={memoElRef}
          >
            <span className="w-full px-6 pt-5 pb-2 text-sm text-gray-500">{memo.displayTsStr}</span>
            <div className="w-full px-6 text-base pb-4">
              <MemoContent content={memo.content} showFull={true} />
              <MemoResourceListView className="!grid-cols-2" resourceList={memo.resourceList} />
            </div>
            <div className="flex flex-row justify-between items-center w-full bg-gray-100 dark:bg-zinc-700 py-4 px-6">
              <div className="mr-2">
                <img className="h-10 w-auto rounded-lg" src={`${user.avatarUrl || "/logo.webp"}`} alt="" />
              </div>
              <div className="w-auto grow truncate flex mr-2 flex-col justify-center items-start">
                <span className="w-full text-sm truncate font-bold text-gray-600 dark:text-gray-300">{user.nickname || user.username}</span>
                <span className="text-xs text-gray-400">
                  {state.memoAmount} MEMOS / {createdDays} DAYS
                </span>
              </div>
              <QRCodeSVG
                value={`${window.location.origin}/m/${memo.id}`}
                size={40}
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
