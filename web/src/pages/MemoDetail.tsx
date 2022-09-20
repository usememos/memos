import dayjs from "dayjs";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate, useParams } from "react-router-dom";
import { memoService, userService } from "../services";
import { UNKNOWN_ID } from "../helpers/consts";
import { isNullorUndefined } from "../helpers/utils";
import { useAppSelector } from "../store";
import useLoading from "../hooks/useLoading";
import Only from "../components/common/OnlyWhen";
import MemoContent from "../components/MemoContent";
import MemoResources from "../components/MemoResources";
import "../less/explore.less";

interface State {
  memo: Memo;
}

const MemoDetail = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
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
    const { host } = userService.getState();
    if (isNullorUndefined(host)) {
      navigate("/auth");
      return;
    }

    const memoId = Number(params.memoId);
    if (memoId && !isNaN(memoId)) {
      memoService.fetchMemoById(memoId).then((memo) => {
        setState({
          memo,
        });
        loadingState.setFinish();
      });
    }
  }, [location]);

  return (
    <section className="page-wrapper explore">
      <div className="page-container">
        <div className="page-header">
          <div className="title-container">
            <img className="logo-img" src="/logo-full.webp" alt="" />
          </div>
          <div className="action-button-container">
            <Only when={!loadingState.isLoading}>
              {user ? (
                <Link to="/" className="btn">
                  <span className="icon">🏠</span> {t("common.back-to-home")}
                </Link>
              ) : (
                <Link to="/auth" className="btn">
                  <span className="icon">👉</span> {t("common.sign-in")}
                </Link>
              )}
            </Only>
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
