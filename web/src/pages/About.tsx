import { Badge } from "@usememos/ui";
import { BookOpenIcon, CodeXmlIcon, ExternalLinkIcon, GitForkIcon, GlobeIcon, HeartIcon, ScissorsIcon, SparklesIcon } from "lucide-react";
import { useState } from "react";
import MemosLogo from "@/components/MemosLogo";
import { WelcomeGuideDialog } from "@/components/WelcomeGuide";
import { useInstance } from "@/contexts/InstanceContext";
import {
  MEMOS_API_DOCUMENTATION_URL,
  MEMOS_DOCUMENTATION_URL,
  MEMOS_GITHUB_URL,
  MEMOS_WEBSITE_URL,
  WEB_CLIPPER_URL,
} from "@/lib/constants";
import { getReleaseTag } from "@/lib/release-version";
import { useTranslate } from "@/utils/i18n";

const GITHUB_COMMIT_URL_PREFIX = "https://github.com/usememos/memos/commit/";
const GITHUB_RELEASE_URL_PREFIX = "https://github.com/usememos/memos/releases/tag/";

const DEFAULT_TITLE = "Memos";

/** One card per project link; the welcome guide reopens from a button in the same frame. */
const PROJECT_CARD_CLASSES =
  "group flex h-full flex-col rounded-mu-xl border border-mu-edge p-5 transition-colors hover:bg-mu-hover mu-focus focus-visible:border-mu-focus @min-[60rem]:p-6";

const isCommitSha = (commit: string) => /^[0-9a-f]{7,40}$/i.test(commit);

const Chip = ({ href, children }: { href?: string; children: React.ReactNode }) => {
  const className = "inline-flex max-w-full items-center rounded-mu-md bg-mu-well px-2 py-1 font-mono mu-caption break-all text-mu-text";
  if (href) {
    return (
      <a
        className={`${className} hover:bg-mu-hover border border-transparent mu-focus focus-visible:border-mu-focus`}
        href={href}
        target="_blank"
        rel="noreferrer"
      >
        {children}
      </a>
    );
  }
  return <span className={className}>{children}</span>;
};

const SectionLabel = ({ children }: { children: React.ReactNode }) => <h2 className="mu-label text-mu-text-secondary">{children}</h2>;

const About = () => {
  const t = useTranslate();
  const { profile, generalSetting } = useInstance();

  const customProfile = generalSetting.customProfile;
  const instanceTitle = customProfile?.title || DEFAULT_TITLE;
  const isCustomBranded = instanceTitle !== DEFAULT_TITLE;

  const releaseTag = getReleaseTag(profile.version);
  const releaseUrl = releaseTag ? `${GITHUB_RELEASE_URL_PREFIX}${releaseTag}` : "";
  const versionLabel = releaseTag ?? profile.version;
  // The version chip is the one place for build identity: a release links to its
  // tag, and a development build such as 26.10.18-dev.3bea6df links to its commit.
  const commitUrl = isCommitSha(profile.commit) ? `${GITHUB_COMMIT_URL_PREFIX}${profile.commit}` : "";
  const versionUrl = releaseUrl || commitUrl;

  const buildRows: { label: string; value: React.ReactNode }[] = [];
  if (isCustomBranded) {
    buildRows.push({
      label: t("about.distribution"),
      value: <span className="mu-caption text-mu-text-secondary">{t("about.powered-by")}</span>,
    });
  }

  const [guideOpen, setGuideOpen] = useState(false);

  const projectLinks = [
    { label: t("about.official-website"), note: t("about.official-website-note"), href: MEMOS_WEBSITE_URL, icon: GlobeIcon },
    { label: t("about.documents"), note: t("about.documents-note"), href: MEMOS_DOCUMENTATION_URL, icon: BookOpenIcon },
    { label: t("about.api-docs"), note: t("about.api-docs-note"), href: MEMOS_API_DOCUMENTATION_URL, icon: CodeXmlIcon },
    {
      label: t("about.github-repository"),
      note: t("about.github-repository-note"),
      href: MEMOS_GITHUB_URL,
      icon: GitForkIcon,
    },
    { label: t("about.web-clipper"), note: t("about.web-clipper-platforms"), href: WEB_CLIPPER_URL, icon: ScissorsIcon },
    { label: t("about.sponsor"), note: t("about.sponsor-note"), href: "https://github.com/sponsors/usememos", icon: HeartIcon },
  ];

  return (
    <section className="min-h-full w-full">
      <div className="@container mx-auto w-full max-w-5xl py-8 sm:py-16">
        <div className="grid gap-10 @min-[52rem]:grid-cols-[minmax(0,0.9fr)_minmax(0,1.5fr)] @min-[52rem]:gap-8">
          <header className="min-w-0 @min-[52rem]:border-e @min-[52rem]:border-mu-line @min-[52rem]:pe-8 @min-[52rem]:pt-7">
            <div className="space-y-3">
              <MemosLogo as="h1" size="hero" />
              {(profile.version || profile.demo) && (
                <div className="flex min-w-0 flex-wrap items-center gap-2.5">
                  {profile.version && (
                    <Chip href={versionUrl || undefined}>
                      <span className="mu-visually-hidden">{t("common.version")} </span>
                      {versionLabel}
                    </Chip>
                  )}
                  {profile.demo && <Badge tone="warning">{t("about.demo")}</Badge>}
                </div>
              )}
            </div>
            <p className="mt-6 text-balance mu-heading wrap-anywhere text-mu-text">
              {customProfile?.description || "Simple note-taking for your everyday thoughts."}
            </p>
            <p className="mt-6 max-w-md mu-body text-mu-text-secondary">{t("about.description")}</p>

            {buildRows.length > 0 && (
              <section className="mt-8 border-t border-mu-line pt-5">
                <SectionLabel>{t("about.build")}</SectionLabel>
                <dl className="mt-3 flex flex-wrap gap-x-8 gap-y-4">
                  {buildRows.map((row) => (
                    <div key={row.label} className="min-w-0 max-w-full">
                      <dt className="mu-caption text-mu-text-secondary">{row.label}</dt>
                      <dd className="mt-2 flex min-h-6 items-center">{row.value}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            )}
          </header>

          <section className="min-w-0">
            <SectionLabel>{t("about.project")}</SectionLabel>
            <nav aria-label={t("about.project-links")} className="mt-4">
              <ul className="grid gap-3 @min-[28rem]:grid-cols-2 @min-[60rem]:gap-4">
                {projectLinks.map((link) => (
                  <li key={link.href} className="min-w-0">
                    <a className={PROJECT_CARD_CLASSES} href={link.href} target="_blank" rel="noreferrer">
                      <span className="flex items-center justify-between text-mu-text-secondary">
                        <link.icon aria-hidden="true" className="mu-icon size-6 @min-[60rem]:size-7" />
                        <ExternalLinkIcon aria-hidden="true" className="mu-icon transition-colors group-hover:text-mu-text" />
                      </span>
                      <span className="mt-5 block mu-label text-mu-text">{link.label}</span>
                      <span className="mt-1 block mu-caption text-mu-text-secondary">{link.note}</span>
                    </a>
                  </li>
                ))}
                {!profile.demo && (
                  <li className="min-w-0">
                    <button type="button" className={`${PROJECT_CARD_CLASSES} w-full text-start`} onClick={() => setGuideOpen(true)}>
                      <span className="flex items-center justify-between text-mu-text-secondary">
                        <SparklesIcon aria-hidden="true" className="mu-icon size-6 @min-[60rem]:size-7" />
                      </span>
                      <span className="mt-5 block mu-label text-mu-text">{t("welcome.reopen")}</span>
                      <span className="mt-1 block mu-caption text-mu-text-secondary">{t("welcome.reopen-note")}</span>
                    </button>
                  </li>
                )}
              </ul>
            </nav>
          </section>
        </div>
      </div>
      <WelcomeGuideDialog open={guideOpen} onOpenChange={setGuideOpen} />
    </section>
  );
};

export default About;
