import { useMutation } from "@tanstack/react-query";
import { CheckIcon, CopyIcon, Loader2Icon, SparklesIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "react-hot-toast";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { memoServiceClient } from "@/connect";
import { useInstance } from "@/contexts/InstanceContext";
import { InstanceSetting_AIProviderType } from "@/types/proto/api/v1/instance_service_pb";
import type {
  GenerateMemoRelationsResponse,
  GenerateMemoSummaryResponse,
  GenerateMemoTagsResponse,
  Memo,
} from "@/types/proto/api/v1/memo_service_pb";

interface Props {
  memo: Memo;
}

type ActiveView = "summary" | "tags" | "relations";

const ACTION_ROW_CLASS =
  "h-auto min-h-0 w-full justify-between rounded-none px-2 py-1.5 text-xs font-normal leading-tight text-muted-foreground transition-colors hover:bg-muted/40 hover:text-muted-foreground focus-visible:ring-offset-0 gap-1.5";

function stripMemoPrefix(name: string): string {
  return name.replace(/^memos\//, "");
}

function getFriendlyErrorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof Error)) {
    return fallback;
  }

  return error.message.replace(/^\[[^\]]+\]\s*rpc error:\s*code\s*=\s*[^\s]+\s*desc\s*=\s*/, "").trim() || fallback;
}

const MemoAISection = ({ memo }: Props) => {
  const { aiSetting } = useInstance();
  const ollamaProviders = useMemo(
    () => aiSetting.providers.filter((provider) => provider.type === InstanceSetting_AIProviderType.OLLAMA),
    [aiSetting.providers],
  );
  const [providerId, setProviderId] = useState("");
  const [activeView, setActiveView] = useState<ActiveView | null>(null);
  const [summary, setSummary] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [relations, setRelations] = useState<GenerateMemoRelationsResponse["relations"]>([]);
  const [copied, setCopied] = useState(false);
  const [copiedSummary, setCopiedSummary] = useState(false);
  const [copiedRelations, setCopiedRelations] = useState(false);

  useEffect(() => {
    if (providerId) {
      return;
    }
    setProviderId(ollamaProviders[0]?.id ?? "");
  }, [ollamaProviders, providerId]);

  const currentProvider = ollamaProviders.find((provider) => provider.id === providerId) ?? ollamaProviders[0];

  const summaryMutation = useMutation({
    mutationFn: async () => memoServiceClient.generateMemoSummary({ name: memo.name, providerId: currentProvider?.id ?? "" }),
    onSuccess: (response: GenerateMemoSummaryResponse) => {
      setSummary(response.summary);
      setActiveView("summary");
    },
    onError: (error) => {
      toast.error(getFriendlyErrorMessage(error, "Failed to generate summary"));
    },
  });

  const tagsMutation = useMutation({
    mutationFn: async () => memoServiceClient.generateMemoTags({ name: memo.name, providerId: currentProvider?.id ?? "" }),
    onSuccess: (response: GenerateMemoTagsResponse) => {
      setTags(response.tags);
      setActiveView("tags");
    },
    onError: (error) => {
      toast.error(getFriendlyErrorMessage(error, "Failed to generate tags"));
    },
  });

  const relationsMutation = useMutation({
    mutationFn: async () => memoServiceClient.generateMemoRelations({ name: memo.name, providerId: currentProvider?.id ?? "" }),
    onSuccess: (response: GenerateMemoRelationsResponse) => {
      setRelations(response.relations);
      setActiveView("relations");
    },
    onError: (error) => {
      toast.error(getFriendlyErrorMessage(error, "Failed to generate relations"));
    },
  });

  if (ollamaProviders.length === 0) {
    return null;
  }

  const isBusy = summaryMutation.isPending || tagsMutation.isPending || relationsMutation.isPending;

  const handleCopyTags = async () => {
    if (tags.length === 0) return;
    await navigator.clipboard.writeText(tags.map((tag) => `#${tag}`).join(" "));
    setCopied(true);
    toast.success("Copied tag suggestions");
    window.setTimeout(() => setCopied(false), 1500);
  };

  const handleCopySummary = async () => {
    if (!summary) return;
    await navigator.clipboard.writeText(summary);
    setCopiedSummary(true);
    toast.success("Copied summary");
    window.setTimeout(() => setCopiedSummary(false), 1500);
  };

  const handleCopyRelations = async () => {
    if (relations.length === 0) return;
    await navigator.clipboard.writeText(relations.map((relation) => `memos/${relation.name}`).join("\n"));
    setCopiedRelations(true);
    toast.success("Copied related memo names");
    window.setTimeout(() => setCopiedRelations(false), 1500);
  };

  return (
    <div className="space-y-2 rounded-md border border-border/50 bg-muted/20 p-3">
      <div className="flex items-center gap-1.5">
        <SparklesIcon className="size-3.5 shrink-0 text-muted-foreground/90" />
        <p className="text-xs font-medium text-muted-foreground/50 uppercase tracking-wider">AI</p>
      </div>

      <Select value={currentProvider?.id ?? "__none__"} onValueChange={setProviderId}>
        <SelectTrigger className="h-8 w-full text-xs">
          <SelectValue placeholder="Select Ollama provider" />
        </SelectTrigger>
        <SelectContent>
          {ollamaProviders.map((provider) => (
            <SelectItem key={provider.id} value={provider.id}>
              {provider.title || stripMemoPrefix(provider.id)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="overflow-hidden rounded-md border border-border/50 bg-background/70">
        <Button variant="ghost" size="sm" className={ACTION_ROW_CLASS} onClick={() => summaryMutation.mutate()} disabled={isBusy}>
          <span className="flex min-w-0 flex-1 items-center gap-2">
            {summaryMutation.isPending ? (
              <Loader2Icon className="size-3.5 shrink-0 animate-spin" />
            ) : (
              <SparklesIcon className="size-3.5 shrink-0" />
            )}
            <span className="truncate">Generate summary</span>
          </span>
        </Button>
        <div className="border-t border-border/50" />
        <Button variant="ghost" size="sm" className={ACTION_ROW_CLASS} onClick={() => tagsMutation.mutate()} disabled={isBusy}>
          <span className="flex min-w-0 flex-1 items-center gap-2">
            {tagsMutation.isPending ? (
              <Loader2Icon className="size-3.5 shrink-0 animate-spin" />
            ) : (
              <CheckIcon className="size-3.5 shrink-0" />
            )}
            <span className="truncate">Suggest tags</span>
          </span>
        </Button>
        <div className="border-t border-border/50" />
        <Button variant="ghost" size="sm" className={ACTION_ROW_CLASS} onClick={() => relationsMutation.mutate()} disabled={isBusy}>
          <span className="flex min-w-0 flex-1 items-center gap-2">
            {relationsMutation.isPending ? (
              <Loader2Icon className="size-3.5 shrink-0 animate-spin" />
            ) : (
              <CopyIcon className="size-3.5 shrink-0" />
            )}
            <span className="truncate">Suggest relations</span>
          </span>
        </Button>
      </div>

      {activeView === "summary" && summary && (
        <div className="rounded-md border border-border/50 bg-background/70 p-3 text-sm text-foreground/80">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground/50">Summary</p>
            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={handleCopySummary} disabled={!summary}>
              {copiedSummary ? "Copied" : "Copy"}
            </Button>
          </div>
          <p className="whitespace-pre-wrap leading-relaxed">{summary}</p>
        </div>
      )}

      {activeView === "tags" && (
        <div className="space-y-2 rounded-md border border-border/50 bg-background/70 p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground/50">Tags</p>
            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={handleCopyTags} disabled={tags.length === 0}>
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center rounded-md border border-border/60 bg-muted/60 px-2 py-1 text-xs text-muted-foreground"
              >
                #{tag}
              </span>
            ))}
          </div>
        </div>
      )}

      {activeView === "relations" && (
        <div className="space-y-2 rounded-md border border-border/50 bg-background/70 p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground/50">Related memos</p>
            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={handleCopyRelations} disabled={relations.length === 0}>
              {copiedRelations ? "Copied" : "Copy names"}
            </Button>
          </div>
          <div className="space-y-2">
            {relations.length === 0 ? (
              <p className="text-sm text-muted-foreground">No related memos found.</p>
            ) : (
              relations.map((relation) => (
                <div key={relation.name} className="rounded-md border border-border/50 bg-muted/20 p-2">
                  <Link className="font-mono text-xs text-muted-foreground hover:text-foreground" to={`/${relation.name}`}>
                    {stripMemoPrefix(relation.name)}
                  </Link>
                  <p className="mt-1 text-xs text-muted-foreground">{relation.reason}</p>
                  {relation.snippet && <p className="mt-1 text-xs text-foreground/70">{relation.snippet}</p>}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default MemoAISection;
