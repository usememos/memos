import { Select, Option } from "@mui/joy";
import { QRCodeSVG } from "qrcode.react";
import React, { useEffect, useRef, useState } from "react";
import { toast } from "react-hot-toast";
import { useTranslation } from "react-i18next";
import copy from "copy-to-clipboard";
import { toLower } from "lodash-es";
import toImage from "@/labs/html2image";
import { useGlobalStore, useMemoStore, useUserStore } from "@/store/module";
import { VISIBILITY_SELECTOR_ITEMS } from "@/helpers/consts";
import * as utils from "@/helpers/utils";
import { getMemoStats } from "@/helpers/api";
import useLoading from "@/hooks/useLoading";
import Icon from "./Icon";
import { generateDialog } from "./Dialog";
import MemoContent from "./MemoContent";
import MemoResources from "./MemoResources";
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
  const { t } = useTranslation();
  const userStore = useUserStore();
  const memoStore = useMemoStore();
  const globalStore = useGlobalStore();
  const user = userStore.state.user as User;
  const { systemStatus } = globalStore.state;
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
    createdAtStr: utils.getDateTimeString(propsMemo.createdTs),
  };
  const createdDays = Math.ceil((Date.now() - utils.getTimeStampByDate(user.createdTs)) / 1000 / 3600 / 24);

  useEffect(() => {
    getMemoStats(user.id)
      .then(({ data: { data } }) => {
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
        a.download = `memos-${utils.getDateTimeString(Date.now())}.png`;
        a.click();

        createLoadingState.setFinish();
      })
      .catch((err) => {
        console.error(err);
      });
  };

  const handleCopyLinkBtnClick = () => {
    copy(`${window.location.origin}/m/${memo.id}`);
    toast.success(t("message.succeed-copy-link"));
  };

  const memoVisibilityOptionSelectorItems = VISIBILITY_SELECTOR_ITEMS.map((item) => {
    return {
      value: item.value,
      text: t(`memo.visibility.${toLower(item.value)}`),
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
      <div className="dialog-header-container py-3 px-4 pl-6 !mb-0 rounded-t-lg">
        <p className="">{t("common.share")} Memo</p>
        <button className="btn close-btn" onClick={handleCloseBtnClick}>
          <Icon.X className="icon-img" />
        </button>
      </div>
      <div className="dialog-content-container w-full flex flex-col justify-start items-start relative">
        <div className="px-4 pb-3 border-b w-full flex flex-row justify-between items-center">
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
          <div className="flex flex-row justify-end items-center">
            <button disabled={createLoadingState.isLoading} className="btn-normal h-8 mr-2" onClick={handleDownloadBtnClick}>
              {createLoadingState.isLoading ? (
                <Icon.Loader className="w-4 h-auto sm:mr-1 animate-spin" />
              ) : (
                <Icon.Download className="w-4 h-auto sm:mr-1" />
              )}
              <span className="hidden sm:block">{t("common.image")}</span>
            </button>
            <button className="btn-normal h-8" onClick={handleCopyLinkBtnClick}>
              <Icon.Link className="w-4 h-auto sm:mr-1" />
              <span className="hidden sm:block">{t("common.link")}</span>
            </button>
          </div>
        </div>
        <div className="w-full rounded-lg overflow-clip">
          <div
            className="w-96 max-w-full h-auto select-none relative flex flex-col justify-start items-start bg-white dark:bg-zinc-800"
            ref={memoElRef}
          >
            <span className="w-full px-6 pt-5 pb-2 text-sm text-gray-500">{memo.createdAtStr}</span>
            <div className="w-full px-6 text-base pb-4">
              <MemoContent content={memo.content} showFull={true} />
              <MemoResources className="!grid-cols-2" resourceList={memo.resourceList} />
            </div>
            <div className="flex flex-row justify-between items-center w-full bg-gray-100 dark:bg-zinc-700 py-4 px-6">
              <div className="mr-2">
                <img className="h-10 w-auto rounded-lg" src={`${systemStatus.customizedProfile.logoUrl || "/logo.webp"}`} alt="" />
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
