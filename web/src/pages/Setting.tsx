import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import MobileHeader from "@/components/MobileHeader";
import SectionMenuItem from "@/components/Settings/SectionMenuItem";
import {
  DEFAULT_SETTING_SECTION,
  isSettingSectionKey,
  SETTINGS_SECTIONS,
  type SettingSectionDefinition,
  type SettingSectionKey,
} from "@/components/Settings/settingSections";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useInstance } from "@/contexts/InstanceContext";
import useCurrentUser from "@/hooks/useCurrentUser";
import useMediaQuery from "@/hooks/useMediaQuery";
import { User_Role } from "@/types/proto/api/v1/user_service_pb";
import { useTranslate } from "@/utils/i18n";

const Setting = () => {
  const t = useTranslate();
  const sm = useMediaQuery("sm");
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

  const sectionOptions = useMemo(
    () => sectionGroups.all.map((section) => ({ value: section.key, label: t(section.labelKey) })),
    [sectionGroups.all, t],
  );

  useEffect(() => {
    const hash = location.hash.slice(1);
    const nextSection = isSettingSectionKey(hash) && visibleSectionKeys.has(hash) ? hash : DEFAULT_SETTING_SECTION;
    setSelectedSection(nextSection);
  }, [location.hash, visibleSectionKeys]);

  useEffect(() => {
    if (!isHost) {
      return;
    }
    const preloadSettingKeys = new Set(sectionGroups.admin.flatMap((section) => section.preloadSettingKeys ?? []));
    void fetchSettings([...preloadSettingKeys]);
  }, [fetchSettings, isHost, sectionGroups.admin]);

  const handleSectionSelectorItemClick = (section: SettingSectionKey) => {
    window.location.hash = section;
  };

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
        isSelected={selectedSection === section.key}
        onClick={() => handleSectionSelectorItemClick(section.key)}
      />
    ));

  return (
    <section className="@container w-full max-w-5xl min-h-full flex flex-col justify-start items-start sm:pt-3 md:pt-6 pb-8">
      {!sm && <MobileHeader />}
      <div className="w-full px-4 sm:px-6">
        <div className="w-full border border-border flex flex-row justify-start items-start px-4 py-3 rounded-xl bg-background text-muted-foreground">
          {sm && (
            <div className="flex flex-col justify-start items-start w-40 h-auto shrink-0 py-2">
              <span className="text-sm mt-0.5 pl-3 font-mono select-none text-muted-foreground">{t("common.basic")}</span>
              <div className="w-full flex flex-col justify-start items-start mt-1">{renderSectionMenuItems(sectionGroups.basic)}</div>
              {isHost && (
                <>
                  <span className="text-sm mt-4 pl-3 font-mono select-none text-muted-foreground">{t("common.admin")}</span>
                  <div className="w-full flex flex-col justify-start items-start mt-1">{renderSectionMenuItems(sectionGroups.admin)}</div>
                </>
              )}
            </div>
          )}
          <div className="w-full grow sm:pl-4 overflow-x-auto">
            {!sm && (
              <div className="w-auto inline-block my-2">
                <Select
                  value={selectedSection}
                  items={sectionOptions}
                  onValueChange={(value) => handleSectionSelectorItemClick(value as SettingSectionKey)}
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder={t("setting.select-section")} />
                  </SelectTrigger>
                  <SelectContent>
                    {sectionOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <ActiveSection />
          </div>
        </div>
      </div>
    </section>
  );
};

export default Setting;
