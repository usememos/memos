import { useEffect, useRef } from "react";
import { useInstance } from "@/contexts/InstanceContext";

/** Header carrying the challenge token; the server forwards it to the verifier. */
export const CHALLENGE_TOKEN_HEADER = "Challenge-Token";

interface Props {
  /** Receives the token when the user passes, and null when it expires or resets. */
  onToken: (token: string | null) => void;
  /** Bump to reset the widget, for instance after the server rejected a token. */
  resetKey?: number;
}

interface ProviderScript {
  src: string;
  global: "turnstile" | "hcaptcha";
}

// Both providers expose the same explicit-render API shape.
const PROVIDERS: Record<string, ProviderScript> = {
  turnstile: { src: "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit", global: "turnstile" },
  hcaptcha: { src: "https://js.hcaptcha.com/1/api.js?render=explicit", global: "hcaptcha" },
};

interface WidgetApi {
  render: (container: HTMLElement, options: Record<string, unknown>) => string;
  reset: (widgetId?: string) => void;
  remove?: (widgetId: string) => void;
}

const scriptLoads = new Map<string, Promise<WidgetApi>>();

function loadProvider(provider: ProviderScript): Promise<WidgetApi> {
  const existing = scriptLoads.get(provider.src);
  if (existing) {
    return existing;
  }
  const load = new Promise<WidgetApi>((resolve, reject) => {
    const ready = () => {
      const api = (window as unknown as Record<string, WidgetApi | undefined>)[provider.global];
      if (api) resolve(api);
      else reject(new Error(`challenge provider ${provider.global} did not initialize`));
    };
    const script = document.createElement("script");
    script.src = provider.src;
    script.async = true;
    script.onload = ready;
    script.onerror = () => reject(new Error(`failed to load challenge provider ${provider.global}`));
    document.head.appendChild(script);
  });
  scriptLoads.set(provider.src, load);
  return load;
}

/**
 * Renders the proof-of-humanity widget the instance profile asks for, or
 * nothing when the instance has none. The open-source app carries the widget
 * code for the providers it knows; verification happens on the server.
 */
function ChallengeWidget({ onToken, resetKey = 0 }: Props) {
  const { profile } = useInstance();
  const challenge = profile.challenge;
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetRef = useRef<{ api: WidgetApi; id: string } | null>(null);
  const onTokenRef = useRef(onToken);
  onTokenRef.current = onToken;

  const provider = challenge ? PROVIDERS[challenge.provider] : undefined;
  const siteKey = challenge?.siteKey ?? "";

  useEffect(() => {
    if (!provider || !siteKey || !containerRef.current) {
      return;
    }
    let cancelled = false;
    const container = containerRef.current;
    loadProvider(provider)
      .then((api) => {
        if (cancelled) return;
        const id = api.render(container, {
          sitekey: siteKey,
          callback: (token: string) => onTokenRef.current(token),
          "expired-callback": () => onTokenRef.current(null),
          "error-callback": () => onTokenRef.current(null),
        });
        widgetRef.current = { api, id };
      })
      .catch((error: unknown) => {
        console.error(error);
        onTokenRef.current(null);
      });
    return () => {
      cancelled = true;
      const widget = widgetRef.current;
      widgetRef.current = null;
      if (widget) {
        try {
          widget.api.remove?.(widget.id);
        } catch {
          // The provider script may already be gone; nothing to clean up.
        }
      }
      container.replaceChildren();
    };
  }, [provider, siteKey]);

  useEffect(() => {
    if (resetKey === 0) return;
    const widget = widgetRef.current;
    if (widget) {
      widget.api.reset(widget.id);
      onTokenRef.current(null);
    }
  }, [resetKey]);

  if (!provider || !siteKey) {
    return null;
  }
  return <div ref={containerRef} className="flex justify-center" />;
}

export default ChallengeWidget;
