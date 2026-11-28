import { useInstance } from "@/contexts/InstanceContext";
import { getCustomLogoUrl } from "@/lib/branding";
import { cn } from "@/lib/utils";
import IdentityLabel from "./IdentityLabel";
import { MemosMark } from "./MemosMark";

interface Props {
  className?: string;
  collapsed?: boolean;
  as?: "div" | "h1";
  /** Navigation uses header/md; auth pages use lg and About uses hero. */
  size?: keyof typeof LOGO_SCALE;
}

const PRODUCT_NAME = "Memos";

/** `text` sizes the wordmark; `title` sizes a custom instance title, which is a sans title. */
const LOGO_SCALE = {
  sm: { mark: 20, text: "sm", title: "sm" },
  header: { mark: 24, text: "md", title: "sm" },
  md: { mark: 28, text: "md", title: "md" },
  lg: { mark: 32, text: "lg", title: "lg" },
  hero: { mark: 48, text: "hero", title: "hero" },
} as const;

function MemosLogo({ collapsed, size = "md", as: Component = "div", className }: Props) {
  const scale = LOGO_SCALE[size];
  const { generalSetting: instanceGeneralSetting } = useInstance();
  const title = instanceGeneralSetting.customProfile?.title || PRODUCT_NAME;
  // A custom instance title is the operator's own name, not the brand's lettering.
  const wordmark = title === PRODUCT_NAME;
  const logoUrl = getCustomLogoUrl(instanceGeneralSetting.customProfile?.logoUrl);
  // The bird is narrower than it is tall, so its name lands on the sidebar's label rail. A custom
  // logo is square: in the header it takes a row's 20px slot and 4px gap to land there too.
  const railLogo = Boolean(logoUrl) && size === "header";
  const logoSize = railLogo ? 20 : scale.mark;

  return (
    <Component className={cn("memos-logo w-fit min-w-0 max-w-full", className)}>
      <IdentityLabel
        label={title}
        size={wordmark ? scale.text : scale.title}
        wordmark={wordmark}
        collapsed={collapsed}
        className={railLogo ? "gap-1" : undefined}
        wrap={size === "lg" || size === "hero"}
        mark={
          logoUrl ? (
            <img
              src={logoUrl}
              width={logoSize}
              height={logoSize}
              style={{ width: logoSize, height: logoSize }}
              className="shrink-0 select-none object-contain"
              alt={collapsed ? title : ""}
              draggable={false}
              decoding="async"
            />
          ) : (
            <MemosMark
              size={scale.mark}
              className="text-mu-primary"
              label={collapsed ? title : undefined}
              // Like dotcom's lockup, trim transparent margins so the gap follows the visible bird.
              {...(!collapsed ? { viewBox: "112 32 288 448", width: Math.ceil((scale.mark * 288) / 448) } : {})}
            />
          )
        }
      />
    </Component>
  );
}

export default MemosLogo;
