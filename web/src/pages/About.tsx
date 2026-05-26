import { ExternalLinkIcon } from "lucide-react";
import { useEffect, useState } from "react";
import TileSpriteStrip from "@/components/Placeholder/TileSpriteStrip";
import { TILE_SPRITES, type TileSprite } from "@/components/Placeholder/tileSprites";
import SettingGroup from "@/components/Settings/SettingGroup";
import SettingSection from "@/components/Settings/SettingSection";
import { Button } from "@/components/ui/button";

const SPRITE_SCALE = 2;

const PRODUCT_LINKS = [
  { label: "Website", href: "https://usememos.com/" },
  { label: "GitHub", href: "https://github.com/usememos/memos" },
  { label: "Docs", href: "https://usememos.com/docs" },
];

const PRODUCT_POINTS = ["Open. Write. Done.", "Markdown-native.", "Fully yours."];

const SPONSORS = [
  {
    label: "CodeRabbit",
    href: "https://coderabbit.link/usememos",
    description: "Cut code review time & bugs in half, instantly.",
    lightLogo: "https://victorious-bubble-f69a016683.media.strapiapp.com/Orange_Typemark_43bf516c9d.svg",
    darkLogo: "https://victorious-bubble-f69a016683.media.strapiapp.com/White_Typemark_79b9189d19.svg",
  },
  {
    label: "Warp",
    href: "https://go.warp.dev/memos",
    description: "The agentic development environment.",
    lightLogo: "https://raw.githubusercontent.com/warpdotdev/brand-assets/refs/heads/main/Logos/Warp-Wordmark-Black.png",
    darkLogo: "https://raw.githubusercontent.com/warpdotdev/brand-assets/refs/heads/main/Logos/Warp-Wordmark-White.png",
  },
];

type Sponsor = (typeof SPONSORS)[number];

const isDarkThemeName = (theme: string | null): boolean => {
  return theme?.endsWith("-dark") || theme?.endsWith(".dark") || false;
};

const getCurrentThemeUsesDarkLogo = (): boolean => {
  if (typeof document === "undefined") {
    return false;
  }
  return isDarkThemeName(document.documentElement.getAttribute("data-theme"));
};

const BirdSprite = ({ sprite }: { sprite: TileSprite }) => {
  return (
    <figure className="flex w-auto min-w-28 flex-none flex-col items-center gap-3 rounded-xl border border-border bg-muted/20 px-4 py-4 text-center">
      <TileSpriteStrip sprite={sprite} scale={SPRITE_SCALE} className="size-16" testId="about-bird-sprite" />
      <figcaption className="min-w-0">
        <h3 className="font-mono text-sm text-foreground">{sprite.name}</h3>
      </figcaption>
    </figure>
  );
};

const SponsorLogo = ({ sponsor }: { sponsor: Sponsor }) => {
  const [usesDarkLogo, setUsesDarkLogo] = useState(getCurrentThemeUsesDarkLogo);

  useEffect(() => {
    const updateLogoTheme = () => setUsesDarkLogo(getCurrentThemeUsesDarkLogo());

    updateLogoTheme();

    const observer = new MutationObserver(updateLogoTheme);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

    return () => observer.disconnect();
  }, []);

  return (
    <img
      className="h-9 max-w-44 object-contain object-left"
      src={usesDarkLogo ? sponsor.darkLogo : sponsor.lightLogo}
      alt={sponsor.label}
    />
  );
};

const About = () => {
  return (
    <section className="mx-auto w-full max-w-5xl min-h-full flex flex-col justify-start items-start sm:pt-3 md:pt-6 pb-8">
      <div className="w-full px-4 sm:px-6">
        <div className="w-full rounded-xl border border-border bg-background px-4 py-4 text-muted-foreground">
          <SettingSection
            title="About Memos"
            description="Open-source, self-hosted note-taking built for quick capture: Markdown-native, lightweight, and fully yours."
          >
            <SettingGroup>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-center gap-3">
                  <img className="size-12 shrink-0 select-none rounded-md" src="/logo.webp" alt="" draggable={false} />
                  <div className="min-w-0">
                    <h1 className="text-2xl font-semibold tracking-tight text-foreground">Memos</h1>
                    <p className="mt-1 text-sm text-muted-foreground">Capture first. Keep it yours.</p>
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  {PRODUCT_LINKS.map((link) => (
                    <Button key={link.href} asChild variant="outline" size="lg">
                      <a href={link.href} target="_blank" rel="noreferrer">
                        {link.label}
                        <ExternalLinkIcon className="size-3.5" />
                      </a>
                    </Button>
                  ))}
                </div>
              </div>
            </SettingGroup>

            <SettingGroup
              showSeparator
              title="Product"
              description="A small timeline for notes that should be saved now and organized later."
            >
              <div className="grid gap-3 sm:grid-cols-3">
                {PRODUCT_POINTS.map((item) => (
                  <div key={item} className="rounded-lg bg-muted/40 px-3 py-2 text-sm text-foreground">
                    {item}
                  </div>
                ))}
              </div>
            </SettingGroup>

            <SettingGroup showSeparator title="Sponsors" description="Featured sponsors helping keep Memos open-source and independent.">
              <section aria-label="Sponsors" className="grid gap-3 sm:grid-cols-2">
                {SPONSORS.map((sponsor) => (
                  <a
                    key={sponsor.href}
                    href={sponsor.href}
                    target="_blank"
                    rel="noreferrer"
                    className="group flex min-h-32 min-w-0 flex-col justify-between gap-5 rounded-lg border border-border bg-muted/20 px-4 py-4 text-muted-foreground transition-colors hover:border-primary/40 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  >
                    <div className="flex min-w-0 items-start justify-between gap-4">
                      <SponsorLogo sponsor={sponsor} />
                      <ExternalLinkIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground" />
                    </div>
                    <div className="flex min-w-0 flex-col gap-3">
                      <p className="text-sm leading-6 text-muted-foreground">{sponsor.description}</p>
                      <span className="text-xs font-medium text-foreground transition-colors group-hover:text-primary">
                        Visit {sponsor.label}
                      </span>
                    </div>
                  </a>
                ))}
              </section>
            </SettingGroup>

            <SettingGroup showSeparator title="Birds" description="Pixel tile strips used by empty states.">
              <section aria-label="Birds" className="flex flex-row flex-wrap gap-3">
                {TILE_SPRITES.map((sprite) => (
                  <BirdSprite key={sprite.name} sprite={sprite} />
                ))}
              </section>
            </SettingGroup>
          </SettingSection>
        </div>
      </div>
    </section>
  );
};

export default About;
