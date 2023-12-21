import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { useParams } from "react-router-dom";
import Empty from "@/components/Empty";
import MemoViewV1 from "@/components/MemoViewV1";
import MobileHeader from "@/components/MobileHeader";
import UserAvatar from "@/components/UserAvatar";
import { DEFAULT_MEMO_LIMIT } from "@/helpers/consts";
import useLoading from "@/hooks/useLoading";
import { useFilterStore } from "@/store/module";
import { useMemoV1Store, useUserV1Store } from "@/store/v1";
import { Memo } from "@/types/proto/api/v2/memo_service";
import { User } from "@/types/proto/api/v2/user_service";
import { useTranslate } from "@/utils/i18n";

const UserProfile = () => {
  const t = useTranslate();
  const params = useParams();
  const userV1Store = useUserV1Store();
  const loadingState = useLoading();
  const [user, setUser] = useState<User>();
  const filterStore = useFilterStore();
  const memoStore = useMemoV1Store();
  const [memos, setMemos] = useState<Memo[]>([]);
  const [isComplete, setIsComplete] = useState(false);
  const [isRequesting, setIsRequesting] = useState(false);
  const { tag: tagQuery, text: textQuery } = filterStore.state;

  useEffect(() => {
    const username = params.username;
    if (!username) {
      throw new Error("username is required");
    }

    userV1Store
      .getOrFetchUserByUsername(username)
      .then((user) => {
        setUser(user);
        loadingState.setFinish();
      })
      .catch((error) => {
        console.error(error);
        toast.error(t("message.user-not-found"));
      });
  }, [params.username]);

  useEffect(() => {
    fetchMemos();
  }, [tagQuery, textQuery]);

  const fetchMemos = async () => {
    if (!user) {
      return;
    }

    const filters = [`creator == "${user.name}"`, `row_status == "NORMAL"`];
    if (tagQuery) filters.push(`tags == "${tagQuery}"`);
    if (textQuery) filters.push(`content_search == "${textQuery}"`);
    setIsRequesting(true);
    const data = await memoStore.fetchMemos({
      limit: DEFAULT_MEMO_LIMIT,
      offset: memos.length,
      filter: filters.join(" && "),
    });
    setIsRequesting(false);
    setMemos([...memos, ...data]);
    setIsComplete(data.length < DEFAULT_MEMO_LIMIT);
  };

  return (
    <section className="w-full max-w-5xl min-h-full flex flex-col justify-start items-center sm:pt-3 md:pt-6 pb-8">
      <MobileHeader />
      <div className="w-full px-4 sm:px-6 flex flex-col justify-start items-center">
        {!loadingState.isLoading &&
          (user ? (
            <>
              <div className="w-full flex flex-col justify-start items-center py-8">
                <UserAvatar className="!w-20 !h-20 mb-2 drop-shadow" avatarUrl={user?.avatarUrl} />
                <p className="text-3xl text-black opacity-80 dark:text-gray-200">{user?.nickname}</p>
              </div>
              {memos.map((memo) => (
                <MemoViewV1 key={memo.id} memo={memo} lazyRendering showVisibility showPinnedStyle showParent />
              ))}
              {isRequesting && (
                <div className="flex flex-col justify-start items-center w-full my-8">
                  <p className="text-sm text-gray-400 italic">{t("memo.fetching-data")}</p>
                </div>
              )}
              {isComplete ? (
                memos.length === 0 && (
                  <div className="w-full mt-12 mb-8 flex flex-col justify-center items-center italic">
                    <Empty />
                    <p className="mt-2 text-gray-600 dark:text-gray-400">{t("message.no-data")}</p>
                  </div>
                )
              ) : (
                <div className="w-full flex flex-row justify-center items-center my-2">
                  <span className="cursor-pointer text-sm italic text-gray-500  hover:text-green-600" onClick={fetchMemos}>
                    {t("memo.fetch-more")}
                  </span>
                </div>
              )}
            </>
          ) : (
            <p>Not found</p>
          ))}
      </div>
    </section>
  );
};

export default UserProfile;
