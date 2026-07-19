import { ExternalLinkIcon, ScissorsIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useInstance } from "@/contexts/InstanceContext";
import { WEB_CLIPPER_URL } from "@/lib/constants";
import { useTranslate } from "@/utils/i18n";

const GITHUB_COMMIT_URL_PREFIX = "https://github.com/usememos/memos/commit/";
const GITHUB_RELEASE_URL_PREFIX = "https://github.com/usememos/memos/releases/tag/v";

const DEFAULT_TITLE = "Memos";
const DEFAULT_TAGLINE = "Capture first. Keep it yours.";
const DEFAULT_LOGO = "/logo.webp";

const isCommitSha = (commit: string) => /^[0-9a-f]{7,40}$/i.test(commit);
const isSemver = (version: string) => /^\d+\.\d+\.\d+/.test(version);

const Chip = ({ href, children }: { href?: string; children: React.ReactNode }) => {
  const className = "inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 font-mono text-xs text-muted-foreground";
  if (href) {
    return (
      <a className={`${className} hover:bg-accent hover:text-foreground`} href={href} target="_blank" rel="noreferrer">
        {children}
      </a>
    );
  }
  return <span className={className}>{children}</span>;
};

const SectionLabel = ({ children }: { children: React.ReactNode }) => (
  <h2 className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground/55">{children}</h2>
);

const About = () => {
  const t = useTranslate();
  const { profile, generalSetting } = useInstance();

  // Instance identity: custom branding when the admin has set it, Memos defaults otherwise.
  const customProfile = generalSetting.customProfile;
  const instanceTitle = customProfile?.title || DEFAULT_TITLE;
  const instanceTagline = customProfile?.description || DEFAULT_TAGLINE;
  const instanceLogo = customProfile?.logoUrl || DEFAULT_LOGO;
  const isCustomBranded = instanceTitle !== DEFAULT_TITLE;

  // Dev builds report version "dev" and commit "unknown"; show the raw version and skip the commit row.
  const hasSemver = isSemver(profile.version);
  const releaseUrl = hasSemver ? `${GITHUB_RELEASE_URL_PREFIX}${profile.version}` : "";
  const versionLabel = hasSemver ? `v${profile.version}` : profile.version;
  const hasCommitSha = isCommitSha(profile.commit);
  const commitUrl = hasCommitSha ? `${GITHUB_COMMIT_URL_PREFIX}${profile.commit}` : "";
  const shortCommit = hasCommitSha ? profile.commit.slice(0, 7) : "";

  const buildRows: { label: string; value: React.ReactNode }[] = [];
  if (profile.version) {
    buildRows.push({ label: t("common.version"), value: <Chip href={releaseUrl || undefined}>{versionLabel}</Chip> });
  }
  if (shortCommit) {
    buildRows.push({ label: t("about.commit"), value: <Chip href={commitUrl}>{shortCommit}</Chip> });
  }
  buildRows.push({ label: t("about.license"), value: <Chip href="https://github.com/usememos/memos/blob/main/LICENSE">MIT</Chip> });
  if (isCustomBranded) {
    buildRows.push({
      label: t("about.distribution"),
      value: <span className="text-[13px] text-muted-foreground">{t("about.powered-by")}</span>,
    });
  }

  const projectLinks = [
    { label: t("about.official-website"), note: "the project homepage", href: "https://usememos.com/" },
    { label: t("about.documents"), note: "deploy, configure, use", href: "https://usememos.com/docs" },
    { label: "API Docs", note: "REST + gRPC reference", href: "https://usememos.com/docs/api" },
    { label: t("about.github-repository"), note: "source, issues, releases", href: "https://github.com/usememos/memos" },
    { label: "Web Clipper", note: t("about.web-clipper-platforms"), href: WEB_CLIPPER_URL, icon: ScissorsIcon },
  ];

  return (
    <section className="mx-auto w-full max-w-5xl min-h-full flex flex-col justify-start items-start sm:pt-3 md:pt-6 pb-8">
      <div className="mx-auto w-full max-w-2xl px-1 py-6 sm:py-8">
        <header>
          <img className="size-10 shrink-0 select-none rounded-md" src={instanceLogo} alt="" draggable={false} />
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <h1 className="text-lg font-semibold tracking-tight text-foreground">{instanceTitle}</h1>
            {profile.demo && <Badge variant="warning">Demo</Badge>}
          </div>
          <p className="mt-1 max-w-md text-[26px] font-light leading-snug tracking-[-0.015em] text-foreground">{instanceTagline}</p>
        </header>

        <section className="mt-9">
          <SectionLabel>{t("about.build")}</SectionLabel>
          <dl className="mt-2.5 border-t border-border">
            {buildRows.map((row) => (
              <div key={row.label} className="grid grid-cols-[110px_1fr] items-center border-b border-border/60 py-2">
                <dt className="text-[13px] text-muted-foreground">{row.label}</dt>
                <dd className="m-0 flex min-w-0 items-center">{row.value}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="mt-9">
          <SectionLabel>{t("about.project")}</SectionLabel>
          <nav aria-label="Project links" className="mt-2.5 border-t border-border">
            {projectLinks.map((link) => (
              <a
                key={link.href}
                className="group flex items-baseline justify-between gap-4 border-b border-border/60 py-2.5"
                href={link.href}
                target="_blank"
                rel="noreferrer"
              >
                <span className="flex min-w-0 items-baseline gap-2">
                  {link.icon && <link.icon className="size-3.5 shrink-0 translate-y-0.5 text-muted-foreground" />}
                  <span className="text-[13px] font-medium text-foreground group-hover:underline group-hover:underline-offset-2">
                    {link.label}
                  </span>
                  <span className="hidden truncate text-xs text-muted-foreground sm:inline">{link.note}</span>
                </span>
                <span className="inline-flex shrink-0 items-center gap-1 font-mono text-xs text-muted-foreground group-hover:text-foreground">
                  {link.href.replace("https://", "")}
                  <ExternalLinkIcon className="size-3" />
                </span>
              </a>
            ))}
          </nav>
        </section>

        <p className="mt-8 text-xs text-muted-foreground">Free and open source under the MIT license.</p>
      </div>
    </section>
  );
};

export default About;
