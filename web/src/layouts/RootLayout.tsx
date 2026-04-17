import { useEffect } from "react";
import { Outlet, useLocation, useSearchParams } from "react-router-dom";
import usePrevious from "react-use/lib/usePrevious";
import Navigation from "@/components/Navigation";
import { useInstance } from "@/contexts/InstanceContext";
import { useMemoFilterContext } from "@/contexts/MemoFilterContext";
import useMediaQuery from "@/hooks/useMediaQuery";
import { cn } from "@/lib/utils";
import { useTranslate } from "@/utils/i18n";

const MEMOS_DEPLOY_URL = "https://usememos.com/docs/deploy";

const DemoBanner = () => {
  const t = useTranslate();

  return (
    <div className="static w-full border-b border-border bg-muted/70 px-4 py-2 text-sm text-muted-foreground sm:px-6">
      <div className="mx-auto flex max-w-5xl flex-col items-start gap-1 sm:flex-row sm:items-center sm:justify-center sm:gap-2">
        <span className="font-medium text-foreground">{t("demo.banner-title")}</span>
        <span>{t("demo.banner-description")}</span>
        <a className="font-medium text-primary underline-offset-4 hover:underline" href={MEMOS_DEPLOY_URL} target="_blank" rel="noreferrer">
          {t("demo.deploy-link")}
        </a>
      </div>
    </div>
  );
};

const RootLayout = () => {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const sm = useMediaQuery("sm");
  const { profile } = useInstance();
  const { removeFilter } = useMemoFilterContext();
  const { pathname } = location;
  const prevPathname = usePrevious(pathname);

  useEffect(() => {
    // When the route changes and there is no filter in the search params, remove all filters.
    if (prevPathname !== pathname && !searchParams.has("filter")) {
      removeFilter(() => true);
    }
  }, [prevPathname, pathname, searchParams, removeFilter]);

  return (
    <div className="w-full min-h-full flex flex-row justify-center items-start sm:pl-16">
      {sm && (
        <div
          className={cn(
            "group flex flex-col justify-start items-start fixed top-0 left-0 select-none h-full bg-sidebar",
            "w-16 px-2",
            "border-r border-border",
          )}
        >
          <Navigation className="py-4 md:pt-6" collapsed={true} />
        </div>
      )}
      <main className="w-full h-auto grow shrink flex flex-col justify-start items-center">
        {profile.demo && <DemoBanner />}
        <Outlet />
      </main>
    </div>
  );
};

export default RootLayout;
