import { badgeClasses, Popover, Tooltip } from "@usememos/ui";
import { BellIcon, EllipsisIcon } from "lucide-react";
import { useId, useRef, useState } from "react";
import { Link, matchPath, useLocation } from "react-router-dom";
import UserAvatar from "@/components/UserAvatar";
import UserMenu from "@/components/UserMenu";
import { useAppSidebar } from "@/contexts/AppSidebarContext";
import useCurrentUser from "@/hooks/useCurrentUser";
import { useSSEConnectionStatus } from "@/hooks/useLiveMemoRefresh";
import { useUnreadInbox } from "@/hooks/useUnreadInbox";
import { cn } from "@/lib/utils";
import { ROUTES } from "@/router/routes";
import { useTranslate } from "@/utils/i18n";
import { SIDEBAR_ROW_BOX_CLASSES, SIDEBAR_ROW_SLOT_BUTTON_CLASSES, SIDEBAR_ROW_SLOT_CLASSES, sidebarRowStateClasses } from "./SidebarRow";
import { measureSidebarPanelWidth, SIDEBAR_RAIL_CLASSES } from "./sidebar-layout";

const FOCUS_CLASSES = "border border-transparent mu-focus focus-visible:border-mu-focus";

/**
 * The row's main control is its whole surface, lying under the content, so a second control (the
 * Inbox link, a guest's menu) can sit on the row without nesting. Its hit area runs past the 28px
 * row to the footer's edges, gutters and last pixel row included: the foot of the sidebar is the
 * easiest place to land a pointer, and nothing else is there.
 */
const SURFACE_CLASSES = cn(
  "absolute -inset-px rounded-(--mu-row-radius) after:absolute after:-inset-x-[13px] after:-top-[5px] after:-bottom-[13px] after:content-['']",
  FOCUS_CLASSES,
);

/**
 * A second control on the row keeps its small drawn size, but its hit area takes the footer's
 * full 44px height, so a near miss does not fire the row's own action. Hovering it clears the
 * row's fill (see the row box): the feedback is the control's, not the row's.
 */
const ROW_CONTROL_HIT_CLASSES = "after:absolute after:-top-[9px] after:-bottom-[17px] after:content-['']";

const MORE_GLYPH_CLASSES = "mu-icon-sm text-mu-text-secondary/70 transition-colors group-hover:text-mu-text";

/**
 * The sidebar's last row is the person using it: avatar and name on the row grammar, quieter than
 * the title above (small sans in secondary ink against the title's serif). The whole row opens the
 * account menu. An Inbox mark sits on the row only while something is unread, as a link of its own;
 * with nothing unread the Inbox is the menu's first row.
 *
 * A guest's row is the same row with nobody in it: a blank avatar, "Sign in" where the name goes,
 * and the same ⋯ in the same place. There the row signs in and the ⋯ is its own control, opening
 * the menu cut down to preferences and About.
 */
const SidebarAccount = () => {
  const t = useTranslate();
  const location = useLocation();
  const currentUser = useCurrentUser();
  const { setMobileOpen } = useAppSidebar();
  const sseStatus = useSSEConnectionStatus();
  const unread = useUnreadInbox();
  const [open, setOpen] = useState(false);
  const [menuWidth, setMenuWidth] = useState<number>();
  const rowRef = useRef<HTMLDivElement>(null);
  const statusId = useId();
  const accountLabel = currentUser?.displayName || currentUser?.username || t("common.profile");
  // The dot on the avatar says the live connection is down; the row's control carries the words.
  const statusText = currentUser && sseStatus !== "connected" ? t(`live-update.${sseStatus}` as Parameters<typeof t>[0]) : undefined;

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) return;
    const width = measureSidebarPanelWidth(rowRef.current);
    if (width) setMenuWidth(width);
  };

  return (
    <footer
      className={cn(
        // Full-bleed across the scroller's rail padding, then back onto the rail.
        "sticky bottom-0 -mx-3 shrink-0 pt-1 pb-3 opaque:border-t opaque:border-mu-line/70 opaque:bg-mu-canvas",
        SIDEBAR_RAIL_CLASSES,
      )}
    >
      {/* No line above the row: a list row passing under it goes soft, then disappears. Over
          empty space the strip shows nothing, so a short list looks untouched. */}
      <div
        aria-hidden="true"
        data-sidebar-veil
        className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-linear-to-b from-transparent to-mu-canvas/94 to-58% mask-t-from-45% backdrop-blur-[5px] opaque:hidden"
      />
      <Popover.Root open={open} onOpenChange={handleOpenChange}>
        <div
          ref={rowRef}
          // The transparent border is the one a plain row reserves for focus, so avatar and name sit on the
          // rows' rails to the pixel; with it, `pe-[3px]` puts the 20px ⋯ on the rail's action axis.
          className={cn(
            SIDEBAR_ROW_BOX_CLASSES,
            "relative border border-transparent pe-[3px] has-[[data-row-control]:hover]:bg-transparent",
            sidebarRowStateClasses(open && currentUser ? "current" : "idle"),
          )}
        >
          {currentUser ? (
            <Popover.Trigger
              aria-label={`${t("setting.sso.account")}: ${accountLabel}`}
              aria-describedby={statusText ? statusId : undefined}
              title={statusText}
              className={SURFACE_CLASSES}
            />
          ) : (
            <Link
              to={ROUTES.AUTH}
              aria-label={t("common.sign-in-to-memos")}
              className={SURFACE_CLASSES}
              onClick={() => setMobileOpen(false)}
            />
          )}
          <span className={cn(SIDEBAR_ROW_SLOT_CLASSES, "pointer-events-none relative")} aria-hidden="true">
            {/* 2px inside its slot, like the title's avatar: a solid circle reads larger than a 16px glyph. */}
            <UserAvatar avatarUrl={currentUser?.avatarUrl} name={currentUser ? accountLabel : undefined} className="size-[18px]" />
            {statusText && (
              <span
                className={cn(
                  "absolute -bottom-0.5 -end-0.5 size-2.5 rounded-full border-2 border-mu-canvas",
                  sseStatus === "connecting" ? "animate-pulse bg-mu-text-secondary motion-reduce:animate-none" : "bg-mu-danger-key",
                )}
              />
            )}
          </span>
          {statusText && (
            <span id={statusId} className="mu-visually-hidden">
              {statusText}
            </span>
          )}
          {/* The control under the row already carries these words as its name. */}
          <span data-sidebar-label aria-hidden="true" className="min-w-0 flex-1 truncate text-start">
            {currentUser ? accountLabel : t("common.sign-in-to-memos")}
          </span>
          {currentUser && unread.count > 0 && (
            <Link
              to={ROUTES.INBOX}
              viewTransition
              data-row-control
              aria-label={unread.label}
              aria-current={matchPath(ROUTES.INBOX, location.pathname) ? "page" : undefined}
              className={cn(
                badgeClasses({ tone: "neutral", size: "xs" }),
                "relative transition-colors hover:bg-mu-hover after:inset-x-0",
                ROW_CONTROL_HIT_CLASSES,
                FOCUS_CLASSES,
              )}
              onClick={() => setMobileOpen(false)}
            >
              <BellIcon aria-hidden="true" className="mu-icon-xs" />
              <span className="tabular-nums text-mu-accent">{unread.text}</span>
            </Link>
          )}
          {currentUser ? (
            <span className={SIDEBAR_ROW_SLOT_CLASSES} aria-hidden="true">
              <EllipsisIcon className={MORE_GLYPH_CLASSES} />
            </span>
          ) : (
            <Tooltip.Root>
              <Tooltip.Trigger
                render={
                  <Popover.Trigger
                    data-row-control
                    aria-label={t("common.more")}
                    // Out to the sidebar's corner: the ⋯ is the guest's only way to the preferences.
                    className={cn(
                      SIDEBAR_ROW_SLOT_BUTTON_CLASSES,
                      "data-popup-open:bg-mu-hover after:-start-2 after:-end-[17px]",
                      ROW_CONTROL_HIT_CLASSES,
                    )}
                  >
                    <EllipsisIcon aria-hidden="true" className={MORE_GLYPH_CLASSES} />
                  </Popover.Trigger>
                }
              />
              <Tooltip.Popup side="top">{t("common.more")}</Tooltip.Popup>
            </Tooltip.Root>
          )}
        </div>
        {/* Anchored to the row, not to whichever control opened it, so the panel always sits on the rail. */}
        <Popover.Popup
          variant="list"
          side="top"
          align="start"
          anchor={rowRef}
          positionMethod="fixed"
          aria-label={currentUser ? t("setting.sso.account") : t("common.more")}
          className="mu-compact w-[min(15rem,calc(100vw-1rem))] max-h-[calc(100dvh-5rem)] overflow-y-auto"
          style={menuWidth ? { width: `${menuWidth}px` } : undefined}
        >
          <UserMenu onClose={() => setOpen(false)} />
        </Popover.Popup>
      </Popover.Root>
    </footer>
  );
};

export default SidebarAccount;
