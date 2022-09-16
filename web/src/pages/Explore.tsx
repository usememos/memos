import dayjs from "dayjs";
import { useEffect, useState } from "react";
import { locationService, memoService, userService } from "../services";
import { useAppSelector } from "../store";
import useI18n from "../hooks/useI18n";
import useQuery from "../hooks/useQuery";
import useLoading from "../hooks/useLoading";
import Only from "../components/common/OnlyWhen";
import MemoContent from "../components/MemoContent";
import MemoResources from "../components/MemoResources";
import "../less/explore.less";

interface State {
  memos: Memo[];
}

const Explore = () => {
  const { t, locale } = useI18n();
  const query = useQuery();
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
          let filteredMemos = memos;

          const memoId = Number(query.get("memoId"));
          if (memoId && !isNaN(memoId)) {
            filteredMemos = filteredMemos.filter((memo) => {
              return memo.id === memoId;
            });
          }

          setState({
            ...state,
            memos: filteredMemos,
          });
        });
        loadingState.setFinish();
      });
  }, [location]);

  return (
    <section className="page-wrapper explore">
      <div className="page-container">
        <div className="page-header">
          <div className="title-container">
            <img className="logo-img" src="/logo.webp" alt="" />
            <span className="title-text">Explore</span>
          </div>
          <div className="action-button-container">
            <Only when={!loadingState.isLoading}>
              {user ? (
                <button className="btn" onClick={() => (window.location.href = "/")}>
                  <span className="icon">🏠</span> {t("common.back-to-home")}
                </button>
              ) : (
                <button className="btn" onClick={() => (window.location.href = "/auth")}>
                  <span className="icon">👉</span> {t("common.sign-in")}
                </button>
              )}
            </Only>
          </div>
        </div>
        <Only when={!loadingState.isLoading}>
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
        </Only>
      </div>
    </section>
  );
};

export default Explore;
