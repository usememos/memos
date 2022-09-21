import dayjs from "dayjs";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { memoService } from "../services";
import { useAppSelector } from "../store";
import useLoading from "../hooks/useLoading";
import MemoContent from "../components/MemoContent";
import MemoResources from "../components/MemoResources";
import "../less/explore.less";

interface State {
  memos: Memo[];
}

const Explore = () => {
  const { t, i18n } = useTranslation();
  const user = useAppSelector((state) => state.user.user);
  const location = useAppSelector((state) => state.location);
  const [state, setState] = useState<State>({
    memos: [],
  });
  const loadingState = useLoading();

  useEffect(() => {
    memoService.fetchAllMemos().then((memos) => {
      setState({
        memos,
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
            {!loadingState.isLoading && user ? (
              <Link to="/" className="btn">
                <span className="icon">🏠</span> {t("common.back-to-home")}
              </Link>
            ) : (
              <Link to="/auth" className="btn">
                <span className="icon">👉</span> {t("common.sign-in")}
              </Link>
            )}
          </div>
        </div>
        {!loadingState.isLoading && (
          <main className="memos-wrapper">
            {state.memos.length > 0 ? (
              state.memos.map((memo) => {
                const createdAtStr = dayjs(memo.createdTs).locale(i18n.language).format("YYYY/MM/DD HH:mm:ss");
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
              })
            ) : (
              <p className="w-full text-center mt-12 text-gray-600">{t("message.no-memos")}</p>
            )}
          </main>
        )}
      </div>
    </section>
  );
};

export default Explore;
