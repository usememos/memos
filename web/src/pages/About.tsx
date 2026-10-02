import { BookOpenIcon, CodeXmlIcon, ExternalLinkIcon, GitForkIcon, GlobeIcon, HeartIcon, ScissorsIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
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
const DEFAULT_LOGO = "/logo.webp";

const isCommitSha = (commit: string) => /^[0-9a-f]{7,40}$/i.test(commit);

const Chip = ({ href, children }: { href?: string; children: React.ReactNode }) => {
  const className = "inline-flex max-w-full items-center rounded-md bg-muted px-2 py-1 font-mono text-xs break-all text-foreground";
  if (href) {
    return (
      <a
        className={`${className} hover:bg-accent focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring`}
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

const SectionLabel = ({ children }: { children: React.ReactNode }) => (
  <h2 className="text-sm font-medium text-muted-foreground">{children}</h2>
);

const About = () => {
  const t = useTranslate();
  const { profile, generalSetting } = useInstance();

  const customProfile = generalSetting.customProfile;
  const instanceTitle = customProfile?.title || DEFAULT_TITLE;
  const instanceLogo = customProfile?.logoUrl || DEFAULT_LOGO;
  const isCustomBranded = instanceTitle !== DEFAULT_TITLE;

  const releaseTag = getReleaseTag(profile.version);
  const releaseUrl = releaseTag ? `${GITHUB_RELEASE_URL_PREFIX}${releaseTag}` : "";
  const versionLabel = releaseTag ?? profile.version;
  const hasCommitSha = isCommitSha(profile.commit);
  const commitUrl = hasCommitSha ? `${GITHUB_COMMIT_URL_PREFIX}${profile.commit}` : "";
  const shortCommit = hasCommitSha ? profile.commit.slice(0, 7) : "";

  const buildRows: { label: string; value: React.ReactNode }[] = [];
  if (shortCommit) {
    buildRows.push({ label: t("about.commit"), value: <Chip href={commitUrl}>{shortCommit}</Chip> });
  }
  if (isCustomBranded) {
    buildRows.push({
      label: t("about.distribution"),
      value: <span className="text-[13px] text-muted-foreground">{t("about.powered-by")}</span>,
    });
  }

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
          <header className="min-w-0 @min-[52rem]:border-e @min-[52rem]:border-border @min-[52rem]:pe-8 @min-[52rem]:pt-7">
            <div className="flex items-center gap-4">
              <img
                className="size-16 shrink-0 select-none rounded-xl object-contain @min-[60rem]:size-20"
                src={instanceLogo}
                alt=""
                draggable={false}
              />
              <div className="flex min-w-0 flex-wrap items-center gap-2.5">
                <h1 className="text-3xl font-semibold tracking-tight wrap-anywhere text-foreground @min-[60rem]:text-4xl">
                  {instanceTitle}
                </h1>
                {profile.version && (
                  <Chip href={releaseUrl || undefined}>
                    <span className="sr-only">{t("common.version")} </span>
                    {versionLabel}
                  </Chip>
                )}
                {profile.demo && <Badge variant="warning">{t("about.demo")}</Badge>}
              </div>
            </div>
            <p className="mt-8 text-4xl leading-[1.15] tracking-tight wrap-anywhere text-foreground @min-[60rem]:text-[3.25rem]">
              {customProfile?.description || (
                <>
                  <span className="block">Your thoughts, your data,</span> <span className="block">shared on your terms.</span>
                </>
              )}
            </p>
            <p className="mt-6 max-w-md text-base leading-relaxed text-muted-foreground @min-[60rem]:text-lg">{t("about.description")}</p>

            {buildRows.length > 0 && (
              <section className="mt-8 border-t border-border pt-5">
                <SectionLabel>{t("about.build")}</SectionLabel>
                <dl className="mt-3 flex flex-wrap gap-x-8 gap-y-4">
                  {buildRows.map((row) => (
                    <div key={row.label} className="min-w-0 max-w-full">
                      <dt className="text-xs text-muted-foreground">{row.label}</dt>
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
                    <a
                      className="group flex h-full flex-col rounded-xl border border-border p-5 transition-colors hover:border-muted-foreground/40 hover:bg-muted/40 focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring @min-[60rem]:p-6"
                      href={link.href}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <span className="flex items-center justify-between text-muted-foreground">
                        <link.icon aria-hidden="true" className="size-6 @min-[60rem]:size-7" strokeWidth={1.75} />
                        <ExternalLinkIcon aria-hidden="true" className="size-4 transition-colors group-hover:text-foreground" />
                      </span>
                      <span className="mt-5 block text-base font-medium text-foreground @min-[60rem]:text-lg">{link.label}</span>
                      <span className="mt-1 block text-sm leading-relaxed text-muted-foreground @min-[60rem]:text-base">{link.note}</span>
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          </section>
        </div>
      </div>
    </section>
  );
};

export default About;
