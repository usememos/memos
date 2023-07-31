import { useEffect } from "react";
import { toast } from "react-hot-toast";
import { Link, useLocation, useParams } from "react-router-dom";
import Icon from "@/components/Icon";
import Memo from "@/components/Memo";
import useLoading from "@/hooks/useLoading";
import { useGlobalStore, useMemoStore } from "@/store/module";
import { useTranslate } from "@/utils/i18n";

const MemoDetail = () => {
  const t = useTranslate();
  const params = useParams();
  const location = useLocation();
  const globalStore = useGlobalStore();
  const memoStore = useMemoStore();
  const loadingState = useLoading();
  const customizedProfile = globalStore.state.systemStatus.customizedProfile;
  const memoId = Number(params.memoId);
  const memo = memoStore.state.memos.find((memo) => memo.id === memoId);

  useEffect(() => {
    if (memoId && !isNaN(memoId)) {
      memoStore
        .fetchMemoById(memoId)
        .then(() => {
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
      <div className="relative w-full min-h-full mx-auto flex flex-col justify-start items-center pb-6">
        <div className="max-w-2xl w-full flex flex-row justify-center items-center px-4 py-2 mt-2 bg-zinc-100 dark:bg-zinc-800">
          <div className="detail-header flex flex-row justify-start items-center">
            <img className="detail-logo h-10 w-auto rounded-lg mr-2" src={customizedProfile.logoUrl} alt="" />
            <p className="detail-name text-4xl tracking-wide text-black dark:text-white">{customizedProfile.name}</p>
          </div>
        </div>
        {!loadingState.isLoading &&
          (memo ? (
            <>
              <main className="relative flex-grow max-w-2xl w-full min-h-full flex flex-col justify-start items-start px-4">
                <Memo memo={memo} showCreator showFull showRelatedMemos />
              </main>
              <div className="mt-4 w-full flex flex-row justify-center items-center gap-2">
                <Link
                  to="/"
                  className="flex flex-row justify-center items-center text-gray-600 dark:text-gray-300 text-sm px-3 hover:opacity-80 hover:underline"
                >
                  <Icon.Home className="w-4 h-auto mr-1 -mt-0.5" /> {t("router.back-to-home")}
                </Link>
              </div>
            </>
          ) : (
            <>
              <p>Not found</p>
            </>
          ))}
      </div>
    </section>
  );
};

export default MemoDetail;
