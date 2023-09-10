import { useEffect } from "react";
import { toast } from "react-hot-toast";
import HomeSidebar from "@/components/HomeSidebar";
import MemoEditor from "@/components/MemoEditor";
import MemoFilter from "@/components/MemoFilter";
import MemoList from "@/components/MemoList";
import MobileHeader from "@/components/MobileHeader";
import { useGlobalStore, useUserStore } from "@/store/module";
import { useUserV1Store } from "@/store/v1";
import { useTranslate } from "@/utils/i18n";

const Home = () => {
  const t = useTranslate();
  const globalStore = useGlobalStore();
  const userStore = useUserStore();
  const userV1Store = useUserV1Store();
  const user = userStore.state.user;

  useEffect(() => {
    const currentUsername = userStore.getCurrentUsername();
    userV1Store.getOrFetchUserByUsername(currentUsername).catch((error) => {
      console.error(error);
      toast.error(t("message.user-not-found"));
    });
  }, [userStore.getCurrentUsername()]);

  useEffect(() => {
    if (user?.setting.locale) {
      globalStore.setLocale(user.setting.locale);
    }
  }, [user?.setting.locale]);

  return (
    <div className="w-full flex flex-row justify-start items-start">
      <div className="flex-grow shrink w-auto px-4 sm:px-2 sm:pt-4">
        <MobileHeader />
        <div className="w-full h-auto flex flex-col justify-start items-start bg-zinc-100 dark:bg-zinc-800 rounded-lg">
          {!userStore.isVisitorMode() && <MemoEditor className="mb-2" />}
          <MemoFilter />
        </div>
        <MemoList />
      </div>
      <HomeSidebar />
    </div>
  );
};

export default Home;
