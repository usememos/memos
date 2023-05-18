import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { Link, useLocation, useParams } from "react-router-dom";
import { UNKNOWN_ID } from "@/helpers/consts";
import { useGlobalStore, useMemoStore, useUserStore } from "@/store/module";
import useLoading from "@/hooks/useLoading";
import Memo from "@/components/Memo";

interface State {
  memo: Memo;
}

const MemoDetail = () => {
  const { t } = useTranslation();
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
    <section className="relative top-0 w-full h-full overflow-y-auto overflow-x-hidden bg-zinc-100 dark:bg-zinc-800">
      <div className="relative w-full min-h-full mx-auto flex flex-col justify-start items-center pb-8">
        <div className="sticky top-0 z-10 max-w-2xl w-full min-h-full flex flex-row justify-between items-center px-4 py-2 mt-2 bg-zinc-100 dark:bg-zinc-800">
          <div className="flex flex-row justify-start items-center">
            <img className="h-10 w-auto rounded-lg mr-2" src={customizedProfile.logoUrl} alt="" />
            <p className="text-4xl tracking-wide text-black dark:text-white">{customizedProfile.name}</p>
          </div>
          <div className="action-button-container">
            {!loadingState.isLoading && (
              <>
                {user ? (
                  <Link
                    to="/"
                    className="block text-gray-600 dark:text-gray-300 font-mono text-base py-1 border px-3 leading-8 rounded-xl hover:opacity-80 hover:underline"
                  >
                    <span className="text-lg">🏠</span> {t("router.back-to-home")}
                  </Link>
                ) : (
                  <Link
                    to="/auth"
                    className="block text-gray-600 dark:text-gray-300 font-mono text-base py-1 border px-3 leading-8 rounded-xl hover:opacity-80 hover:underline"
                  >
                    <span className="text-lg">👉</span> {t("common.sign-in")}
                  </Link>
                )}
              </>
            )}
          </div>
        </div>
        {!loadingState.isLoading && (
          <main className="relative flex-grow max-w-2xl w-full min-h-full flex flex-col justify-start items-start px-4">
            <Memo memo={state.memo} readonly showRelatedMemos />
          </main>
        )}
      </div>
    </section>
  );
};

export default MemoDetail;
