import { Select, Option } from "@mui/joy";
import { QRCodeSVG } from "qrcode.react";
import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import copy from "copy-to-clipboard";
import { toLower } from "lodash-es";
import toImage from "../labs/html2image";
import { useGlobalStore, useMemoStore, useUserStore } from "../store/module";
import { VISIBILITY_SELECTOR_ITEMS } from "../helpers/consts";
import * as utils from "../helpers/utils";
import { getMemoStats } from "../helpers/api";
import useLoading from "../hooks/useLoading";
import Icon from "./Icon";
import { generateDialog } from "./Dialog";
import toastHelper from "./Toast";
import MemoContent from "./MemoContent";
import MemoResources from "./MemoResources";
import "../less/share-memo-dialog.less";

interface Props extends DialogProps {
  memo: Memo;
}

interface State {
  memoAmount: number;
  memoVisibility: string;
  generatedImgUrl: string;
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
    generatedImgUrl: "",
  });
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
        setState((state) => {
          return {
            ...state,
            memoAmount: data.length,
          };
        });
        loadingState.setFinish();
      })
      .catch((error) => {
        console.error(error);
      });
  }, []);

  useEffect(() => {
    if (loadingState.isLoading) {
      return;
    }

    if (!memoElRef.current) {
      return;
    }
    toImage(memoElRef.current, {
      pixelRatio: window.devicePixelRatio * 2,
    })
      .then((url) => {
        setState((state) => {
          return {
            ...state,
            generatedImgUrl: url,
          };
        });
      })
      .catch((err) => {
        console.error(err);
      });
  }, [loadingState.isLoading]);

  const handleCloseBtnClick = () => {
    destroy();
  };

  const handleDownloadBtnClick = () => {
    const a = document.createElement("a");
    a.href = state.generatedImgUrl;
    a.download = `memos-${utils.getDateTimeString(Date.now())}.png`;
    a.click();
  };

  const handleCopyLinkBtnClick = () => {
    copy(`${window.location.origin}/m/${memo.id}`);
    toastHelper.success(t("message.succeed-copy-link"));
  };

  const memoVisibilityOptionSelectorItems = VISIBILITY_SELECTOR_ITEMS.map((item) => {
    return {
      value: item.value,
      text: t(`memo.visibility.${toLower(item.value)}`),
    };
  });

  const handleMemoVisibilityOptionChanged = async (value: string) => {
    const visibilityValue = value as Visibility;
    setState({
      ...state,
      memoVisibility: visibilityValue,
    });
    await memoStore.patchMemo({
      id: memo.id,
      visibility: visibilityValue,
    });
  };

  return (
    <>
      <div className="dialog-header-container">
        <p className="title-text">{t("common.share")} Memo</p>
        <button className="btn close-btn" onClick={handleCloseBtnClick}>
          <Icon.X className="icon-img" />
        </button>
      </div>
      <div className="dialog-content-container">
        <div className="memo-container" ref={memoElRef}>
          {state.generatedImgUrl !== "" && <img className="memo-shortcut-img" src={state.generatedImgUrl} />}
          <span className="time-text">{memo.createdAtStr}</span>
          <div className="memo-content-wrapper">
            <MemoContent content={memo.content} displayConfig={{ enableExpand: false }} />
            <MemoResources resourceList={memo.resourceList} />
          </div>
          <div className="watermark-container">
            <div className="logo-container">
              <img className="logo-img" src={`${systemStatus.customizedProfile.logoUrl || "/logo.png"}`} alt="" />
            </div>
            <div className="userinfo-container">
              <span className="name-text">{user.nickname || user.username}</span>
              <span className="usage-text">
                {state.memoAmount} MEMOS / {createdDays} DAYS
              </span>
            </div>
            <QRCodeSVG
              value={`${window.location.origin}/m/${memo.id}`}
              size={64}
              bgColor={"#F3F4F6"}
              fgColor={"#4B5563"}
              level={"L"}
              includeMargin={false}
            />
          </div>
        </div>
        <div className="px-4 py-3 w-full flex flex-row justify-between items-center">
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
            <button disabled={state.generatedImgUrl === ""} className="btn-normal mr-2" onClick={handleDownloadBtnClick}>
              {state.generatedImgUrl === "" ? (
                <Icon.Loader className="w-4 h-auto mr-1 animate-spin" />
              ) : (
                <Icon.Download className="w-4 h-auto mr-1" />
              )}
              <span>{t("common.image")}</span>
            </button>
            <button className="btn-normal" onClick={handleCopyLinkBtnClick}>
              <Icon.Link className="w-4 h-auto mr-1" />
              <span>{t("common.link")}</span>
            </button>
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
