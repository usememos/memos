import { Code } from "@connectrpc/connect";
import { LoaderCircleIcon } from "lucide-react";
import { Link, Outlet } from "react-router-dom";
import { Button, buttonVariants } from "@/components/ui/button";
import { useSpaceContext } from "@/contexts/SpaceContext";
import { hasConnectCode } from "@/lib/error";
import NotFound from "@/pages/NotFound";
import { useTranslate } from "@/utils/i18n";
import { ROUTES } from "./routes";

/** Keeps inaccessible or unresolved Space content out of the page and composer. */
export const SpaceRoute = () => {
  const t = useTranslate();
  const { selectedSpaceName, isSpaceReady, spaceError, retrySpace } = useSpaceContext();
  if (!selectedSpaceName) return <NotFound />;
  if (isSpaceReady) return <Outlet />;
  const unavailable = hasConnectCode(spaceError, Code.NotFound, Code.PermissionDenied);
  return (
    <section className="flex min-h-[50vh] w-full flex-col items-center justify-center gap-4 px-4 text-center" role="status">
      {!spaceError ? (
        <>
          <LoaderCircleIcon className="size-5 animate-spin text-muted-foreground" />
          <p>{t("space.loading")}</p>
        </>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">{t(unavailable ? "space.unavailable" : "space.load-error")}</p>
          <div className="flex items-center gap-2">
            {!unavailable && (
              <Button variant="outline" onClick={retrySpace}>
                {t("search.retry")}
              </Button>
            )}
            <Link className={buttonVariants({ variant: "outline" })} to={ROUTES.HOME}>
              {t("space.back-to-memos")}
            </Link>
          </div>
        </>
      )}
    </section>
  );
};
