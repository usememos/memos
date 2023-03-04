import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useGlobalStore, useLocationStore, useMemoStore, useUserStore } from "../store/module";
import { TAG_REG } from "../labs/marked/parser";
import { DEFAULT_MEMO_LIMIT } from "../helpers/consts";
import useLoading from "../hooks/useLoading";
import toastHelper from "../components/Toast";
import Icon from "../components/Icon";
import MemoFilter from "../components/MemoFilter";
import Memo from "../components/Memo";

interface State {
  memos: Memo[];
}

const Explore = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const globalStore = useGlobalStore();
  const locationStore = useLocationStore();
  const userStore = useUserStore();
  const memoStore = useMemoStore();
  const query = locationStore.state.query;
  const [state, setState] = useState<State>({
    memos: [],
  });
  const [isComplete, setIsComplete] = useState<boolean>(false);
  const loadingState = useLoading();
  const customizedProfile = globalStore.state.systemStatus.customizedProfile;
  const user = userStore.state.user;
  const location = locationStore.state;

  useEffect(() => {
    memoStore.fetchAllMemos(DEFAULT_MEMO_LIMIT, 0).then((memos) => {
      if (memos.length < DEFAULT_MEMO_LIMIT) {
        setIsComplete(true);
      }
      setState({
        memos,
      });
      loadingState.setFinish();
    });
  }, [location]);

  const { tag: tagQuery, text: textQuery } = query ?? {};
  const showMemoFilter = Boolean(tagQuery || textQuery);

  const shownMemos = showMemoFilter
    ? state.memos.filter((memo) => {
        let shouldShow = true;

        if (tagQuery) {
          const tagsSet = new Set<string>();
          for (const t of Array.from(memo.content.match(new RegExp(TAG_REG, "g")) ?? [])) {
            const tag = t.replace(TAG_REG, "$1").trim();
            const items = tag.split("/");
            let temp = "";
            for (const i of items) {
              temp += i;
              tagsSet.add(temp);
              temp += "/";
            }
          }
          if (!tagsSet.has(tagQuery)) {
            shouldShow = false;
          }
        }
        return shouldShow;
      })
    : state.memos;

  const sortedMemos = shownMemos.filter((m) => m.rowStatus === "NORMAL");
  const handleFetchMoreClick = async () => {
    try {
      const fetchedMemos = await memoStore.fetchAllMemos(DEFAULT_MEMO_LIMIT, state.memos.length);
      if (fetchedMemos.length < DEFAULT_MEMO_LIMIT) {
        setIsComplete(true);
      } else {
        setIsComplete(false);
      }
      setState({
        memos: state.memos.concat(fetchedMemos),
      });
    } catch (error: any) {
      console.error(error);
      toastHelper.error(error.response.data.message);
    }
  };

  const handleTitleClick = () => {
    if (user) {
      navigate("/");
    } else {
      navigate("/auth");
    }
  };

  return (
    <section className="w-full min-h-full flex flex-col justify-start items-center pb-8 bg-zinc-100 dark:bg-zinc-800">
      <div className="sticky top-0 z-10 max-w-2xl w-full h-auto flex flex-row justify-between backdrop-blur-sm items-center px-4 sm:pr-6 pt-6 mb-2">
        <div className="flex flex-row justify-start items-center cursor-pointer hover:opacity-80" onClick={handleTitleClick}>
          <img className="h-12 w-auto rounded-md mr-2" src={customizedProfile.logoUrl} alt="" />
          <span className="text-xl sm:text-4xl text-gray-700 dark:text-gray-200">{customizedProfile.name}</span>
        </div>
        <div className="flex flex-row justify-end items-center">
          <a
            className="flex flex-row justify-center items-center h-12 w-12 border rounded-full hover:opacity-80 hover:shadow dark:text-white "
            href="/explore/rss.xml"
            target="_blank"
            rel="noreferrer"
          >
            <Icon.Rss className="w-7 h-auto opacity-60" />
          </a>
        </div>
      </div>
      {!loadingState.isLoading && (
        <main className="relative flex-grow max-w-2xl w-full h-auto flex flex-col justify-start items-start px-4 sm:pr-6">
          <MemoFilter />
          {sortedMemos.map((memo) => {
            return <Memo key={`${memo.id}-${memo.createdTs}`} memo={memo} readonly={true} />;
          })}
          {isComplete ? (
            state.memos.length === 0 ? (
              <p className="w-full text-center mt-12 text-gray-600">{t("message.no-memos")}</p>
            ) : null
          ) : (
            <p className="m-auto text-center mt-4 italic cursor-pointer text-gray-500 hover:text-green-600" onClick={handleFetchMoreClick}>
              {t("memo-list.fetch-more")}
            </p>
          )}
        </main>
      )}
    </section>
  );
};

export default Explore;
