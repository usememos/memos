import { LoaderIcon, SparklesIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { LinkPreview } from "@/components/memo-metadata";
import LinkPreviewCard from "@/components/memo-metadata/LinkPreviewCard";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useTranslate } from "@/utils/i18n";

interface LinkPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddPreview: (preview: LinkPreview) => void;
}

const LinkPreviewDialog = ({ open, onOpenChange, onAddPreview }: LinkPreviewDialogProps) => {
  const t = useTranslate();
  const [inputUrl, setInputUrl] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [error, setError] = useState<string>("");
  const [preview, setPreview] = useState<LinkPreview | null>(null);

  useEffect(() => {
    if (!open) {
      setStatus("idle");
      setPreview(null);
      setError("");
    }
  }, [open]);

  const placeholder = useMemo(() => {
    try {
      return new URL(inputUrl).hostname.replace(/^www\./, "");
    } catch {
      return "example.com";
    }
  }, [inputUrl]);

  const handlePreview = () => {
    if (!inputUrl.trim()) {
      setError(t("editor.link-preview-invalid"));
      setStatus("error");
      return;
    }
    try {
      new URL(inputUrl);
    } catch (_err) {
      setError(t("editor.link-preview-invalid"));
      setStatus("error");
      return;
    }

    setStatus("loading");
    setError("");
    setPreview(null);

    fetchPreview(inputUrl, { timeoutMs: 8000 })
      .then((res) => {
        setPreview(res);
        setStatus("ready");
      })
      .catch((err: unknown) => {
        const isAbort = err instanceof DOMException && err.name === "AbortError";
        setError(isAbort ? t("editor.link-preview-timeout") : t("editor.link-preview-fetch-error"));
        setStatus("error");
        setPreview(null);
      });
  };

  const handleAddPreview = () => {
    if (!preview) return;
    onAddPreview(preview);
    onOpenChange(false);
    setInputUrl("");
    setPreview(null);
    setStatus("idle");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{t("editor.scrape-link")}</DialogTitle>
          <DialogDescription>{t("editor.scrape-link-description")}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <div className="space-y-2">
            <Label htmlFor="link-preview-url" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              URL
            </Label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                id="link-preview-url"
                placeholder="https://example.com/article"
                value={inputUrl}
                onChange={(e) => setInputUrl(e.target.value)}
                className="flex-1"
              />
              <Button variant="secondary" onClick={handlePreview} disabled={status === "loading"}>
                {status === "loading" ? <LoaderIcon className="h-4 w-4 animate-spin" /> : t("editor.scrape-link")}
              </Button>
            </div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <SparklesIcon className="h-3.5 w-3.5" />
              <span>{t("editor.scrape-link-description")}</span>
            </div>
          </div>

          <div className="rounded-md border bg-muted/40 p-3">
            {status === "loading" && <Skeleton placeholder={placeholder} />}
            {status !== "loading" && preview && <LinkPreviewCard preview={preview} mode="edit" />}
            {status === "idle" && !preview && (
              <div className="flex flex-col items-start gap-1 text-sm text-muted-foreground">
                <span className="font-medium text-foreground">{t("common.preview")}</span>
                <span>{t("editor.link-preview-empty")}</span>
              </div>
            )}
            {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
          </div>

          {preview && (
            <div className="grid grid-cols-1 gap-3 rounded-md border bg-card/30 p-3">
              <div className="grid gap-1">
                <Label htmlFor="link-preview-title" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {t("common.title")}
                </Label>
                <Input
                  id="link-preview-title"
                  value={preview.title}
                  onChange={(e) => setPreview({ ...preview, title: e.target.value })}
                  placeholder="Edit title"
                />
              </div>
              <div className="grid gap-1">
                <Label htmlFor="link-preview-description" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {t("common.description")}
                </Label>
                <Textarea
                  id="link-preview-description"
                  value={preview.description}
                  onChange={(e) => setPreview({ ...preview, description: e.target.value })}
                  placeholder="Edit description"
                  className="min-h-20"
                />
              </div>
              <div className="grid gap-1">
                <Label htmlFor="link-preview-image" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Cover image URL
                </Label>
                <Input
                  id="link-preview-image"
                  value={preview.imageUrl}
                  onChange={(e) => setPreview({ ...preview, imageUrl: e.target.value })}
                  placeholder="https://example.com/cover.png"
                />
              </div>
              <div className="grid gap-1">
                <Label htmlFor="link-preview-site" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Site name
                </Label>
                <Input
                  id="link-preview-site"
                  value={preview.siteName ?? ""}
                  onChange={(e) => setPreview({ ...preview, siteName: e.target.value })}
                  placeholder={placeholder}
                />
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {t("common.close")}
          </Button>
          <Button onClick={handleAddPreview} disabled={!preview || status === "loading"}>
            {t("common.add")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const Skeleton = ({ placeholder }: { placeholder: string }) => {
  return (
    <div className="flex w-full animate-pulse flex-col gap-2">
      <div className="h-24 w-full rounded-md bg-gradient-to-r from-muted to-muted-foreground/20" />
      <div className="space-y-2">
        <div className="h-3 w-2/3 rounded bg-muted-foreground/30" />
        <div className="h-3 w-3/5 rounded bg-muted-foreground/20" />
        <div className="h-3 w-1/2 rounded bg-muted-foreground/10" />
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <SparklesIcon className="h-3 w-3" />
          <span>{placeholder}</span>
        </div>
      </div>
    </div>
  );
};

function _getHostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

async function fetchPreview(url: string, options?: { timeoutMs?: number }): Promise<LinkPreview> {
  const controller = new AbortController();
  const timeout = options?.timeoutMs ? window.setTimeout(() => controller.abort(), options.timeoutMs) : undefined;
  const response = await fetch(`/api/v1/link:preview?url=${encodeURIComponent(url)}`, {
    credentials: "include",
    signal: controller.signal,
  }).finally(() => {
    if (timeout) window.clearTimeout(timeout);
  });

  if (!response.ok) {
    throw new Error("failed to fetch preview");
  }
  const data = (await response.json()) as {
    preview: { title: string; description: string; imageUrl: string; siteName: string; url: string };
  };
  return {
    id: cryptoId(),
    url: data.preview.url,
    title: data.preview.title,
    description: data.preview.description,
    imageUrl: data.preview.imageUrl,
    siteName: data.preview.siteName,
  };
}

function cryptoId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}`;
}

export default LinkPreviewDialog;
