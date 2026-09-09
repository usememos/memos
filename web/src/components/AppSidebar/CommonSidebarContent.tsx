import { BookOpenIcon, BracesIcon, ExternalLinkIcon, GitForkIcon, InfoIcon, type LucideIcon } from "lucide-react";
import { Link, matchPath, useLocation } from "react-router-dom";
import { useAppSidebar } from "@/contexts/AppSidebarContext";
import useCurrentUser from "@/hooks/useCurrentUser";
import { MEMOS_API_DOCUMENTATION_URL, MEMOS_DOCUMENTATION_URL, MEMOS_GITHUB_URL } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { ROUTES } from "@/router/routes";
import { useTranslate } from "@/utils/i18n";
import { SIDEBAR_ROW_CLASSES, SidebarRowIconSlot, sidebarRowStateClasses } from "./SidebarRow";
import SidebarSection, { SIDEBAR_SECTION_STACK_CLASSES } from "./SidebarSection";

interface ResourceLink {
  labelKey: "about.documents" | "about.api-docs" | "about.github-repository";
  href: string;
  icon: LucideIcon;
}

const RESOURCE_LINKS: ResourceLink[] = [
  { labelKey: "about.documents", href: MEMOS_DOCUMENTATION_URL, icon: BookOpenIcon },
  { labelKey: "about.api-docs", href: MEMOS_API_DOCUMENTATION_URL, icon: BracesIcon },
  { labelKey: "about.github-repository", href: MEMOS_GITHUB_URL, icon: GitForkIcon },
];

const CommonSidebarContent = () => {
  const t = useTranslate();
  const location = useLocation();
  const currentUser = useCurrentUser();
  const { setMobileOpen } = useAppSidebar();
  const aboutActive = Boolean(matchPath(ROUTES.ABOUT, location.pathname));

  return (
    <div className={SIDEBAR_SECTION_STACK_CLASSES}>
      {currentUser && (
        <SidebarSection ariaLabel={t("common.about")}>
          <Link
            to={ROUTES.ABOUT}
            aria-current={aboutActive ? "page" : undefined}
            onClick={() => setMobileOpen(false)}
            className={cn(SIDEBAR_ROW_CLASSES, sidebarRowStateClasses(aboutActive ? "current" : "idle"))}
          >
            <SidebarRowIconSlot icon={InfoIcon} />
            <span className="min-w-0 flex-1 truncate">{t("common.about")}</span>
          </Link>
        </SidebarSection>
      )}

      <SidebarSection label={t("common.resources")}>
        {RESOURCE_LINKS.map((resource) => (
          <a
            key={resource.href}
            href={resource.href}
            target="_blank"
            rel="noreferrer"
            onClick={() => setMobileOpen(false)}
            className={cn(SIDEBAR_ROW_CLASSES, sidebarRowStateClasses())}
          >
            <SidebarRowIconSlot icon={resource.icon} />
            <span className="min-w-0 flex-1 truncate">{t(resource.labelKey)}</span>
            <ExternalLinkIcon
              aria-hidden="true"
              className="size-3 shrink-0 text-muted-foreground/50 transition-colors group-hover:text-foreground/70"
              strokeWidth={1.8}
            />
          </a>
        ))}
      </SidebarSection>
    </div>
  );
};

export default CommonSidebarContent;
