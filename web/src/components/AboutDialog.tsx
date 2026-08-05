import { ExternalLinkIcon, ScissorsIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
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
  <h3 className="text-[10px] font-semibold uppercase tracking-[0.09em] text-muted-foreground/55">{children}</h3>
);

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const AboutDialog = ({ open, onOpenChange }: Props) => {
  const t = useTranslate();
  const { profile, generalSetting } = useInstance();

  const customProfile = generalSetting.customProfile;
  const instanceTitle = customProfile?.title || DEFAULT_TITLE;
  const instanceTagline = customProfile?.description || DEFAULT_TAGLINE;
  const instanceLogo = customProfile?.logoUrl || DEFAULT_LOGO;
  const isCustomBranded = instanceTitle !== DEFAULT_TITLE;

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
    { label: t("about.official-website"), note: t("about.official-website-note"), href: "https://usememos.com/" },
    { label: t("about.documents"), note: t("about.documents-note"), href: "https://usememos.com/docs" },
    { label: t("about.api-docs"), note: t("about.api-docs-note"), href: "https://usememos.com/docs/api" },
    {
      label: t("about.github-repository"),
      note: t("about.github-repository-note"),
      href: "https://github.com/usememos/memos",
    },
    { label: t("about.web-clipper"), note: t("about.web-clipper-platforms"), href: WEB_CLIPPER_URL, icon: ScissorsIcon },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="xl" className="overflow-hidden border-border/70 p-0! shadow-xl">
        <DialogTitle className="sr-only">{t("common.about")}</DialogTitle>
        <div className="px-5 pb-5 pt-5 sm:px-6 sm:pb-6 sm:pt-6">
          <header className="flex items-start gap-3 pr-8">
            <img className="size-10 shrink-0 select-none rounded-md" src={instanceLogo} alt="" draggable={false} />
            <div className="min-w-0 pt-0.5">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="truncate text-[16px] font-semibold tracking-[-0.01em] text-foreground">{instanceTitle}</h2>
                {profile.demo && <Badge variant="warning">{t("about.demo")}</Badge>}
              </div>
              <p className="mt-0.5 text-[13px] leading-5 text-muted-foreground">{instanceTagline}</p>
            </div>
          </header>

          <section className="mt-6">
            <SectionLabel>{t("about.build")}</SectionLabel>
            <dl className="mt-2 border-t border-border/70">
              {buildRows.map((row) => (
                <div key={row.label} className="grid grid-cols-[96px_1fr] items-center border-b border-border/60 py-2">
                  <dt className="text-[12px] text-muted-foreground">{row.label}</dt>
                  <dd className="m-0 flex min-w-0 items-center">{row.value}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section className="mt-6">
            <SectionLabel>{t("about.project")}</SectionLabel>
            <nav aria-label={t("about.project-links")} className="mt-2 border-t border-border/70">
              {projectLinks.map((link) => (
                <a
                  key={link.href}
                  className="group flex items-center justify-between gap-4 border-b border-border/60 py-2.5"
                  href={link.href}
                  target="_blank"
                  rel="noreferrer"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    {link.icon && <link.icon className="size-3.5 shrink-0 text-muted-foreground" />}
                    <span className="truncate text-[13px] font-medium text-foreground group-hover:underline group-hover:underline-offset-2">
                      {link.label}
                    </span>
                    <span className="hidden truncate text-xs text-muted-foreground sm:inline">{link.note}</span>
                  </span>
                  <ExternalLinkIcon className="size-3 shrink-0 text-muted-foreground group-hover:text-foreground" />
                </a>
              ))}
            </nav>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AboutDialog;
