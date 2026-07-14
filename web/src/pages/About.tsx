import { ExternalLinkIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useInstance } from "@/contexts/InstanceContext";
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

const About = () => {
  const t = useTranslate();
  const { profile, generalSetting } = useInstance();

  // Instance identity: custom branding when the admin has set it, Memos defaults otherwise.
  const customProfile = generalSetting.customProfile;
  const instanceTitle = customProfile?.title || DEFAULT_TITLE;
  const instanceTagline = customProfile?.description || DEFAULT_TAGLINE;
  const instanceLogo = customProfile?.logoUrl || DEFAULT_LOGO;
  const isCustomBranded = instanceTitle !== DEFAULT_TITLE;

  // Dev builds report version "dev" and commit "unknown"; show the raw version and skip the commit chip.
  const hasSemver = isSemver(profile.version);
  const releaseUrl = hasSemver ? `${GITHUB_RELEASE_URL_PREFIX}${profile.version}` : "";
  const versionLabel = hasSemver ? `v${profile.version}` : profile.version;
  const hasCommitSha = isCommitSha(profile.commit);
  const commitUrl = hasCommitSha ? `${GITHUB_COMMIT_URL_PREFIX}${profile.commit}` : "";
  const shortCommit = hasCommitSha ? profile.commit.slice(0, 7) : "";

  const projectLinks = [
    { label: t("about.official-website"), note: "the project homepage", href: "https://usememos.com/" },
    { label: t("about.documents"), note: "deploy, configure, use", href: "https://usememos.com/docs" },
    { label: "API Docs", note: "REST + gRPC reference", href: "https://usememos.com/docs/api" },
    { label: t("about.github-repository"), note: "source, issues, releases", href: "https://github.com/usememos/memos" },
  ];

  return (
    <section className="mx-auto w-full max-w-5xl min-h-full flex flex-col justify-start items-start sm:pt-3 md:pt-6 pb-8">
      <div className="w-full">
        <div className="w-full rounded-xl border border-border bg-background px-4 py-4 text-muted-foreground">
          <div className="flex min-w-0 items-center gap-4">
            <img className="size-16 shrink-0 select-none rounded-md" src={instanceLogo} alt="" draggable={false} />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-semibold tracking-tight text-foreground">{instanceTitle}</h1>
                {profile.demo && <Badge variant="warning">Demo</Badge>}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{instanceTagline}</p>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {profile.version && <Chip href={releaseUrl || undefined}>{versionLabel}</Chip>}
                {shortCommit && <Chip href={commitUrl}>{shortCommit}</Chip>}
                {isCustomBranded && <Chip>Powered by Memos</Chip>}
              </div>
            </div>
          </div>

          <nav aria-label="Project links" className="mt-5">
            {projectLinks.map((link) => (
              <a
                key={link.href}
                className="group flex flex-col gap-0.5 border-t border-border py-3 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4"
                href={link.href}
                target="_blank"
                rel="noreferrer"
              >
                <span className="min-w-0">
                  <span className="text-sm font-medium text-foreground group-hover:underline group-hover:underline-offset-2">
                    {link.label}
                  </span>
                  <span className="ml-2 text-xs text-muted-foreground">{link.note}</span>
                </span>
                <span className="inline-flex shrink-0 items-center gap-1 font-mono text-xs text-muted-foreground group-hover:text-foreground">
                  {link.href.replace("https://", "")}
                  <ExternalLinkIcon className="size-3" />
                </span>
              </a>
            ))}
          </nav>

          <p className="border-t border-border pt-3 text-xs text-muted-foreground">Free and open source under the MIT license.</p>
        </div>
      </div>
    </section>
  );
};

export default About;
