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

const LOGO_SCALE = {
  sm: { mark: 20, text: "sm" },
  header: { mark: 24, text: "md" },
  md: { mark: 28, text: "md" },
  lg: { mark: 32, text: "lg" },
  hero: { mark: 48, text: "hero" },
} as const;

function MemosLogo({ collapsed, size = "md", as: Component = "div", className }: Props) {
  const scale = LOGO_SCALE[size];
  const { generalSetting: instanceGeneralSetting } = useInstance();
  const title = instanceGeneralSetting.customProfile?.title || "Memos";
  const logoUrl = getCustomLogoUrl(instanceGeneralSetting.customProfile?.logoUrl);

  return (
    <Component className={cn("memos-logo w-fit min-w-0 max-w-full", className)}>
      <IdentityLabel
        label={title}
        size={scale.text}
        collapsed={collapsed}
        wrap={size === "lg" || size === "hero"}
        mark={
          logoUrl ? (
            <img
              src={logoUrl}
              width={scale.mark}
              height={scale.mark}
              style={{ width: scale.mark, height: scale.mark }}
              className="shrink-0 select-none object-contain"
              alt={collapsed ? title : ""}
              draggable={false}
              decoding="async"
            />
          ) : (
            <MemosMark
              size={scale.mark}
              className="text-primary"
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
