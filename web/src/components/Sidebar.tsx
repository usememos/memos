import { useContext, useEffect, useMemo, useRef } from "react";
import appContext from "../stores/appContext";
import { SHOW_SIDERBAR_MOBILE_CLASSNAME } from "../helpers/consts";
import { globalStateService } from "../services";
import UserBanner from "./UserBanner";
import ShortcutList from "./ShortcutList";
import TagList from "./TagList";
import UsageHeatMap from "./UsageHeatMap";
import "../less/siderbar.less";

interface Props {}

const Sidebar: React.FC<Props> = () => {
  const {
    locationState,
    globalState: { isMobileView, showSiderbarInMobileView },
  } = useContext(appContext);
  const wrapperElRef = useRef<HTMLElement>(null);

  const handleClickOutsideOfWrapper = useMemo(() => {
    return (event: MouseEvent) => {
      const siderbarShown = globalStateService.getState().showSiderbarInMobileView;

      if (!siderbarShown) {
        window.removeEventListener("click", handleClickOutsideOfWrapper, {
          capture: true,
        });
        return;
      }

      if (!wrapperElRef.current?.contains(event.target as Node)) {
        if (wrapperElRef.current?.parentNode?.contains(event.target as Node)) {
          if (siderbarShown) {
            event.stopPropagation();
          }
          globalStateService.setShowSiderbarInMobileView(false);
          window.removeEventListener("click", handleClickOutsideOfWrapper, {
            capture: true,
          });
        }
      }
    };
  }, []);

  useEffect(() => {
    globalStateService.setShowSiderbarInMobileView(false);
  }, [locationState]);

  useEffect(() => {
    if (showSiderbarInMobileView) {
      document.body.classList.add(SHOW_SIDERBAR_MOBILE_CLASSNAME);
    } else {
      document.body.classList.remove(SHOW_SIDERBAR_MOBILE_CLASSNAME);
    }
  }, [showSiderbarInMobileView]);

  useEffect(() => {
    if (isMobileView && showSiderbarInMobileView) {
      window.addEventListener("click", handleClickOutsideOfWrapper, {
        capture: true,
      });
    }
  }, [isMobileView, showSiderbarInMobileView]);

  return (
    <aside className="sidebar-wrapper" ref={wrapperElRef}>
      <UserBanner />
      <UsageHeatMap />
      <ShortcutList />
      <TagList />
    </aside>
  );
};

export default Sidebar;
