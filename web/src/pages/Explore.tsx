import dayjs from "dayjs";
import { useEffect, useState } from "react";
import { locationService, memoService, userService } from "../services";
import { useAppSelector } from "../store";
import useI18n from "../hooks/useI18n";
import useLoading from "../hooks/useLoading";
import MemoContent from "../components/MemoContent";
import MemoResources from "../components/MemoResources";
import "../less/explore.less";

interface State {
  memos: Memo[];
}

const Explore = () => {
  const { t, locale } = useI18n();
  const user = useAppSelector((state) => state.user.user);
  const location = useAppSelector((state) => state.location);
  const [state, setState] = useState<State>({
    memos: [],
  });
  const loadingState = useLoading();

  useEffect(() => {
    userService
      .initialState()
      .catch()
      .finally(async () => {
        const { host } = userService.getState();
        if (!host) {
          locationService.replaceHistory("/auth");
          return;
        }

        memoService.fetchAllMemos().then((memos) => {
          setState({
            ...state,
            memos,
          });
        });
        loadingState.setFinish();
      });
  }, [location]);

  return (
    <section className="page-wrapper explore">
      <div className="page-container">
        <div className="page-header">
          <img className="logo-img" src="/logo-full.webp" alt="" />
          <div className="action-button-container">
            {user ? (
              <button className="btn" onClick={() => (window.location.href = "/")}>
                <span className="icon">🏠</span> {t("common.back-to-home")}
              </button>
            ) : (
              <button className="btn" onClick={() => (window.location.href = "/auth")}>
                <span className="icon">👉</span> {t("common.sign-in")}
              </button>
            )}
          </div>
        </div>
        {loadingState.isLoading ? null : (
          <main className="memos-wrapper">
            {state.memos.map((memo) => {
              const createdAtStr = dayjs(memo.createdTs).locale(locale).format("YYYY/MM/DD HH:mm:ss");
              return (
                <div className="memo-container" key={memo.id}>
                  <div className="memo-header">
                    <span className="time-text">{createdAtStr}</span>
                    <span className="split-text">by</span>
                    <a className="name-text" href={`/u/${memo.creator.id}`}>
                      {memo.creator.name}
                    </a>
                  </div>
                  <MemoContent className="memo-content" content={memo.content} onMemoContentClick={() => undefined} />
                  <MemoResources memo={memo} />
                </div>
              );
            })}
          </main>
        )}
      </div>
    </section>
  );
};

export default Explore;
