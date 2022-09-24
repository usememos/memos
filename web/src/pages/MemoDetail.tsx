import dayjs from "dayjs";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useParams } from "react-router-dom";
import { memoService } from "../services";
import { UNKNOWN_ID } from "../helpers/consts";
import { useAppSelector } from "../store";
import useLoading from "../hooks/useLoading";
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

  const handleVisibilitySelectorChange = async (visibility: Visibility) => {
    if (state.memo.visibility === visibility) {
      return;
    }

    await memoService.patchMemo({
      id: state.memo.id,
      visibility: visibility,
    });
    setState({
      ...state,
      memo: {
        ...state.memo,
        visibility: visibility,
      },
    });
  };

  return (
    <section className="page-wrapper memo-detail">
      <div className="page-container">
        <div className="page-header">
          <div className="title-container">
            <img className="logo-img" src="/logo-full.webp" alt="" />
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
                <span className="time-text">{dayjs(state.memo.createdTs).locale(i18n.language).format("YYYY/MM/DD HH:mm:ss")}</span>
                <span className="split-text">by</span>
                <a className="name-text" href={`/u/${state.memo.creator.id}`}>
                  {state.memo.creator.name}
                </a>
                {user?.id === state.memo.creatorId && (
                  <Dropdown
                    className="visibility-selector"
                    trigger={
                      <span className={`status-text ${state.memo.visibility.toLowerCase()}`}>
                        {state.memo.visibility} <Icon.ChevronDown className="w-4 h-auto ml-px" />
                      </span>
                    }
                    actions={
                      <>
                        <span className="action-button" onClick={() => handleVisibilitySelectorChange("PRIVATE")}>
                          Private
                        </span>
                        <span className="action-button" onClick={() => handleVisibilitySelectorChange("PROTECTED")}>
                          Protected
                        </span>
                        <span className="action-button" onClick={() => handleVisibilitySelectorChange("PUBLIC")}>
                          Public
                        </span>
                      </>
                    }
                    actionsClassName="!w-28 !left-0 !p-1"
                  />
                )}
              </div>
              <MemoContent className="memo-content" content={state.memo.content} onMemoContentClick={() => undefined} />
              <MemoResources memo={state.memo} />
            </div>
          </main>
        )}
      </div>
    </section>
  );
};

export default MemoDetail;
