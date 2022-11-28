import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import copy from "copy-to-clipboard";
import { toLower } from "lodash";
import toImage from "../labs/html2image";
import { ANIMATION_DURATION, VISIBILITY_SELECTOR_ITEMS } from "../helpers/consts";
import * as utils from "../helpers/utils";
import { getMemoStats } from "../helpers/api";
import { memoService, userService } from "../services";
import useLoading from "../hooks/useLoading";
import Icon from "./Icon";
import { generateDialog } from "./Dialog";
import toastHelper from "./Toast";
import MemoContent from "./MemoContent";
import MemoResources from "./MemoResources";
import Selector from "./common/Selector";
import "../less/share-memo-image-dialog.less";

interface Props extends DialogProps {
  memo: Memo;
}

interface State {
  memoAmount: number;
  shortcutImgUrl: string;
  memoVisibility: string;
}

const ShareMemoImageDialog: React.FC<Props> = (props: Props) => {
  const { memo: propsMemo, destroy } = props;
  const { t } = useTranslation();
  const user = userService.getState().user as User;
  const [state, setState] = useState<State>({
    memoAmount: 0,
    shortcutImgUrl: "",
    memoVisibility: propsMemo.visibility,
  });
  const loadingState = useLoading();
  const memoElRef = useRef<HTMLDivElement>(null);
  const memo = {
    ...propsMemo,
    createdAtStr: utils.getDateTimeString(propsMemo.displayTs),
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

    setTimeout(() => {
      if (!memoElRef.current) {
        return;
      }

      toImage(memoElRef.current, {
        backgroundColor: "#f4f4f5",
        pixelRatio: window.devicePixelRatio * 2,
      })
        .then((url) => {
          setState((state) => {
            return {
              ...state,
              shortcutImgUrl: url,
            };
          });
        })
        .catch((err) => {
          console.error(err);
        });
    }, ANIMATION_DURATION);
  }, [loadingState.isLoading]);

  const handleCloseBtnClick = () => {
    destroy();
  };

  const handleDownloadBtnClick = () => {
    const a = document.createElement("a");
    a.href = state.shortcutImgUrl;
    a.download = `memos-${utils.getDateTimeString(Date.now())}.png`;
    a.click();
  };

  const handleCopyLinkBtnClick = () => {
    copy(`${window.location.origin}/m/${memo.id}`);
    toastHelper.success(t("message.succeed-copy-content"));
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
    await memoService.patchMemo({
      id: memo.id,
      visibility: visibilityValue,
    });
  };

  return (
    <>
      <div className="dialog-header-container">
        <p className="title-text">
          <span className="icon-text">🌄</span>
          {t("common.share")} Memo
        </p>
        <button className="btn close-btn" onClick={handleCloseBtnClick}>
          <Icon.X className="icon-img" />
        </button>
      </div>
      <div className="dialog-content-container">
        <div className="memo-container" ref={memoElRef}>
          {state.shortcutImgUrl !== "" && <img className="memo-shortcut-img" src={state.shortcutImgUrl} />}
          <span className="time-text">{memo.createdAtStr}</span>
          <div className="memo-content-wrapper">
            <MemoContent content={memo.content} displayConfig={{ enableExpand: false }} />
            <MemoResources style="col" resourceList={memo.resourceList} />
          </div>
          <div className="watermark-container">
            <div className="userinfo-container">
              <span className="name-text">{user.nickname || user.username}</span>
              <span className="usage-text">
                {createdDays} DAYS / {state.memoAmount} MEMOS
              </span>
            </div>
            <img className="logo-img" src="/logo.webp" alt="" />
          </div>
        </div>
        <div className="share-actions-container">
          <div className="visibility-selector">
            <Selector
              className="visibility-selector"
              value={state.memoVisibility}
              dataSource={memoVisibilityOptionSelectorItems}
              handleValueChanged={handleMemoVisibilityOptionChanged}
            />
          </div>
          <div className="share-btns-container">
            <div className="buttons-wrapper">
              <div className="share-btn share-image-btn" onClick={handleDownloadBtnClick}>
                <Icon.Download className="icon-img" />
                <span>{t("common.image")}</span>
              </div>
            </div>
            <div className="buttons-wrapper">
              <div className="share-btn share-link-btn" onClick={handleCopyLinkBtnClick}>
                <Icon.Link className="icon-img" />
                <span>{t("common.link")}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default function showShareMemoImageDialog(memo: Memo): void {
  generateDialog(
    {
      className: "share-memo-image-dialog",
    },
    ShareMemoImageDialog,
    { memo }
  );
}
