import copy from "copy-to-clipboard";
import dayjs from "dayjs";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useParams } from "react-router-dom";
import { memoService } from "../services";
import { UNKNOWN_ID } from "../helpers/consts";
import { useAppSelector } from "../store";
import useLoading from "../hooks/useLoading";
import useApperance from "../hooks/useApperance";
import Icon from "../components/Icon";
import toastHelper from "../components/Toast";
import Dropdown from "../components/common/Dropdown";
import MemoContent from "../components/MemoContent";
import MemoResources from "../components/MemoResources";
import "../less/memo-detail.less";

interface State {
  memo: Memo;
}

const MemoDetail = () => {
  useApperance();

  const { t, i18n } = useTranslation();
  const params = useParams();
  const user = useAppSelector((state) => state.user.user);
  const location = useAppSelector((state) => state.location);
  const [state, setState] = useState<State>({
    memo: {
      id: UNKNOWN_ID,
    } as Memo,
  });
  const loadingState = useLoading();

  useEffect(() => {
    const memoId = Number(params.memoId);
    if (memoId && !isNaN(memoId)) {
      memoService
        .fetchMemoById(memoId)
        .then((memo) => {
          setState({
            memo,
          });
          loadingState.setFinish();
        })
        .catch((error) => {
          console.error(error);
          toastHelper.error(error.response.data.message);
        });
    }
  }, [location]);

  const handleCopyContent = () => {
    copy(state.memo.content);
    toastHelper.success(t("message.succeed-copy-content"));
  };

  return (
    <section className="page-wrapper memo-detail">
      <div className="page-container">
        <div className="page-header">
          <div className="title-container">
            <img className="logo-img" src="/logo.webp" alt="" />
            <p className="logo-text">memos</p>
          </div>
          <div className="action-button-container">
            {!loadingState.isLoading && (
              <>
                {user ? (
                  <Link to="/" className="btn">
                    <span className="icon">🏠</span> {t("common.back-to-home")}
                  </Link>
                ) : (
                  <Link to="/auth" className="btn">
                    <span className="icon">👉</span> {t("common.sign-in")}
                  </Link>
                )}
              </>
            )}
          </div>
        </div>
        {!loadingState.isLoading && (
          <main className="memos-wrapper">
            <div className="memo-container">
              <div className="memo-header">
                <div className="status-container">
                  <span className="time-text">{dayjs(state.memo.displayTs).locale(i18n.language).format("YYYY/MM/DD HH:mm:ss")}</span>
                  <a className="name-text" href={`/u/${state.memo.creator.id}`}>
                    @{state.memo.creator.nickname || state.memo.creator.username}
                  </a>
                </div>
                <Dropdown
                  trigger={<Icon.MoreHorizontal className="ml-2 w-4 h-auto cursor-pointer text-gray-500" />}
                  actionsClassName="!w-32"
                  actions={
                    <>
                      <button
                        className="w-full flex flex-row justify-start items-center px-3 whitespace-nowrap text-sm text-left leading-8 cursor-pointer rounded hover:bg-gray-100"
                        onClick={handleCopyContent}
                      >
                        {t("memo.copy")}
                      </button>
                    </>
                  }
                />
              </div>
              <MemoContent className="memo-content" content={state.memo.content} onMemoContentClick={() => undefined} />
              <MemoResources resourceList={state.memo.resourceList} />
            </div>
          </main>
        )}
      </div>
    </section>
  );
};

export default MemoDetail;
