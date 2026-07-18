import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import MobileHeader from "@/components/MobileHeader";
import SectionChip from "@/components/Settings/SectionChip";
import SectionMenuItem from "@/components/Settings/SectionMenuItem";
import {
  DEFAULT_SETTING_SECTION,
  isSettingSectionKey,
  SETTINGS_SECTIONS,
  type SettingSectionDefinition,
  type SettingSectionKey,
} from "@/components/Settings/settingSections";
import { useInstance } from "@/contexts/InstanceContext";
import useCurrentUser from "@/hooks/useCurrentUser";
import useMediaQuery from "@/hooks/useMediaQuery";
import { User_Role } from "@/types/proto/api/v1/user_service_pb";
import { useTranslate } from "@/utils/i18n";

const NAV_GROUP_LABEL_CLASSES = "mb-1 px-2 text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground/55 select-none";

const Setting = () => {
  const t = useTranslate();
  const sm = useMediaQuery("sm");
  const md = useMediaQuery("md");
  const location = useLocation();
  const user = useCurrentUser();
  const { fetchSettings } = useInstance();
  const [selectedSection, setSelectedSection] = useState<SettingSectionKey>(DEFAULT_SETTING_SECTION);
  const isHost = user?.role === User_Role.ADMIN;

  const sectionGroups = useMemo(() => {
    const visibleSections = SETTINGS_SECTIONS.filter((section) => section.scope === "basic" || isHost);
    return {
      basic: visibleSections.filter((section) => section.scope === "basic"),
      admin: visibleSections.filter((section) => section.scope === "admin"),
      all: visibleSections,
    };
  }, [isHost]);

  const visibleSectionKeys = useMemo(() => new Set(sectionGroups.all.map((section) => section.key)), [sectionGroups.all]);

  useEffect(() => {
    const hash = location.hash.slice(1);
    const nextSection = isSettingSectionKey(hash) && visibleSectionKeys.has(hash) ? hash : DEFAULT_SETTING_SECTION;
    setSelectedSection(nextSection);
  }, [location.hash, visibleSectionKeys]);

  // Jump back to the top when switching sections; skip the initial hash sync so
  // scroll restoration on back-navigation still wins.
  const prevSectionRef = useRef<SettingSectionKey | null>(null);
  useEffect(() => {
    if (prevSectionRef.current && prevSectionRef.current !== selectedSection) {
      window.scrollTo({ top: 0 });
    }
    prevSectionRef.current = selectedSection;
  }, [selectedSection]);

  useEffect(() => {
    if (!isHost) {
      return;
    }
    const preloadSettingKeys = new Set(sectionGroups.admin.flatMap((section) => section.preloadSettingKeys ?? []));
    void fetchSettings([...preloadSettingKeys]);
  }, [fetchSettings, isHost, sectionGroups.admin]);

  const selectedSectionDefinition =
    sectionGroups.all.find((section) => section.key === selectedSection) ??
    SETTINGS_SECTIONS.find((section) => section.key === DEFAULT_SETTING_SECTION) ??
    SETTINGS_SECTIONS[0];
  const ActiveSection = selectedSectionDefinition.component;

  const renderSectionMenuItems = (sections: SettingSectionDefinition[]) =>
    sections.map((section) => (
      <SectionMenuItem
        key={section.key}
        text={t(section.labelKey)}
        icon={section.icon}
        href={`#${section.key}`}
        isSelected={selectedSection === section.key}
      />
    ));

  const renderSectionChips = (sections: SettingSectionDefinition[]) =>
    sections.map((section) => (
      <SectionChip key={section.key} text={t(section.labelKey)} href={`#${section.key}`} isSelected={selectedSection === section.key} />
    ));

  return (
    <section className="w-full min-h-full">
      {!sm && <MobileHeader />}
      <div className="mx-auto flex w-full max-w-6xl flex-row items-start gap-8 px-4 pt-2 pb-12 sm:px-6 sm:pt-4 md:pt-8 lg:gap-10">
        {md && (
          <aside className="sticky top-8 flex w-48 shrink-0 flex-col gap-4">
            <h1 className="px-2 text-base font-semibold tracking-tight text-foreground">{t("common.settings")}</h1>
            <nav className="flex flex-col gap-4">
              <div className="flex flex-col gap-0.5">
                {isHost && <p className={NAV_GROUP_LABEL_CLASSES}>{t("common.basic")}</p>}
                {renderSectionMenuItems(sectionGroups.basic)}
              </div>
              {isHost && (
                <div className="flex flex-col gap-0.5 border-t border-border/60 pt-3">
                  <p className={NAV_GROUP_LABEL_CLASSES}>{t("common.admin")}</p>
                  {renderSectionMenuItems(sectionGroups.admin)}
                </div>
              )}
            </nav>
          </aside>
        )}
        <main className="min-w-0 flex-1">
          {!md && (
            <header className="mb-5 flex flex-col gap-3">
              <h1 className="text-lg font-semibold tracking-tight text-foreground">{t("common.settings")}</h1>
              <nav
                className="-mx-4 flex items-center gap-1.5 overflow-x-auto px-4 pb-1 sm:-mx-6 sm:px-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                aria-label={t("common.settings")}
              >
                {renderSectionChips(sectionGroups.basic)}
                {isHost && <span className="mx-1 h-4 w-px shrink-0 bg-border" aria-hidden="true" />}
                {isHost && renderSectionChips(sectionGroups.admin)}
              </nav>
            </header>
          )}
          <ActiveSection />
        </main>
      </div>
    </section>
  );
};

export default Setting;
