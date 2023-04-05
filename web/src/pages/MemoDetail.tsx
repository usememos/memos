import dayjs from "dayjs";
import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { Link, useLocation, useParams } from "react-router-dom";
import { UNKNOWN_ID } from "@/helpers/consts";
import { useGlobalStore, useMemoStore, useUserStore } from "@/store/module";
import useLoading from "@/hooks/useLoading";
import MemoContent from "@/components/MemoContent";
import MemoResources from "@/components/MemoResources";
import "@/less/memo-detail.less";

interface State {
  memo: Memo;
}

const MemoDetail = () => {
  const { t, i18n } = useTranslation();
  const params = useParams();
  const location = useLocation();
  const globalStore = useGlobalStore();
  const memoStore = useMemoStore();
  const userStore = useUserStore();
  const [state, setState] = useState<State>({
    memo: {
      id: UNKNOWN_ID,
    } as Memo,
  });
  const loadingState = useLoading();
  const customizedProfile = globalStore.state.systemStatus.customizedProfile;
  const user = userStore.state.user;

  useEffect(() => {
    const memoId = Number(params.memoId);
    if (memoId && !isNaN(memoId)) {
      memoStore
        .fetchMemoById(memoId)
        .then((memo) => {
          setState({
            memo,
          });
          loadingState.setFinish();
        })
        .catch((error) => {
          console.error(error);
          toast.error(error.response.data.message);
        });
    }
  }, [location]);

  return (
    <section className="page-wrapper memo-detail">
      <div className="page-container">
        <div className="page-header">
          <div className="title-container">
            <img className="h-10 w-auto rounded-lg mr-2" src={customizedProfile.logoUrl} alt="" />
            <p className="logo-text">{customizedProfile.name}</p>
          </div>
          <div className="action-button-container">
            {!loadingState.isLoading && (
              <>
                {user ? (
                  <Link to="/" className="btn">
                    <span className="icon">🏠</span> {t("router.back-to-home")}
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
                  <span className="time-text">{dayjs(state.memo.createdTs).locale(i18n.language).format("YYYY/MM/DD HH:mm:ss")}</span>
                  <a className="name-text" href={`/u/${state.memo.creatorId}`}>
                    @{state.memo.creatorName}
                  </a>
                </div>
              </div>
              <MemoContent className="memo-content" content={state.memo.content} showFull={true} onMemoContentClick={() => undefined} />
              <MemoResources resourceList={state.memo.resourceList} />
            </div>
          </main>
        )}
      </div>
    </section>
  );
};

export default MemoDetail;
