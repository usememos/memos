import { SettingsIcon, SparklesIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import ChatComposer from "@/components/AIHub/ChatComposer";
import ChatThread from "@/components/AIHub/ChatThread";
import ContextRail from "@/components/AIHub/ContextRail";
import { Button } from "@/components/ui/button";
import { aiServiceClient } from "@/connect";
import { useInstance } from "@/contexts/InstanceContext";
import { useAiChat } from "@/hooks/useAiChat";
import { useTagCounts } from "@/hooks/useUserQueries";
import { buildContextFilter } from "@/lib/ai-context";
import { isChatCapableProviderType } from "@/lib/ai-providers";
import { ROUTES } from "@/router/routes";
import { InstanceSetting_Key } from "@/types/proto/api/v1/instance_service_pb";
import { useTranslate } from "@/utils/i18n";

/** Debounce for the context estimate, so typing a tag filter is not a request storm. */
const ESTIMATE_DEBOUNCE_MS = 300;

/**
 * The AI Hub: chat with your notes, and let the model propose note changes that
 * you confirm. The conversation lives in this component (the server keeps no
 * chat state), while the notes the model may read are chosen explicitly in the
 * context rail.
 */
const AIHub = () => {
  const t = useTranslate();
  const { aiSetting, fetchSetting } = useInstance();
  const { data: tagCounts } = useTagCounts();
  const { messages, isSending, send, resolveProposal } = useAiChat();

  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [estimate, setEstimate] = useState<{ memoCount: number; estimatedTokens: number; budgetTokens: number; fits: boolean }>();
  const [estimateError, setEstimateError] = useState<string>();
  const [isEstimating, setIsEstimating] = useState(false);

  const chatConfig = aiSetting.chat;
  const providerId = chatConfig?.providerId ?? "";
  const model = chatConfig?.model ?? "";

  // Chat needs both a chat-capable provider and a model, so the page can explain
  // exactly what is missing instead of failing on send.
  const chatProvider = useMemo(() => aiSetting.providers.find((provider) => provider.id === providerId), [aiSetting.providers, providerId]);
  const isConfigured = Boolean(providerId && model && chatProvider && isChatCapableProviderType(chatProvider.type));

  const availableTags = useMemo(
    () =>
      Object.entries(tagCounts ?? {})
        .map(([tag, count]) => ({ tag, count }))
        .sort((left, right) => right.count - left.count || left.tag.localeCompare(right.tag)),
    [tagCounts],
  );

  const filter = useMemo(() => buildContextFilter(selectedTags), [selectedTags]);

  // Estimate the selection whenever it changes. The server resolves the filter
  // under the caller's access scope, so the numbers shown match what a turn
  // would actually read.
  const requestIdRef = useRef(0);
  useEffect(() => {
    if (!isConfigured) {
      setEstimate(undefined);
      setEstimateError(undefined);
      return;
    }

    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    setIsEstimating(true);

    const timer = window.setTimeout(async () => {
      try {
        const response = await aiServiceClient.estimateChatContext({
          filter,
        });
        // Ignore a stale response that a newer selection already superseded.
        if (requestIdRef.current !== requestId) return;
        setEstimate({
          memoCount: Number(response.memoCount),
          estimatedTokens: Number(response.estimatedTokens),
          budgetTokens: Number(response.contextBudgetTokens),
          fits: response.fits,
        });
        setEstimateError(undefined);
      } catch (error: unknown) {
        if (requestIdRef.current !== requestId) return;
        setEstimate(undefined);
        setEstimateError(error instanceof Error ? error.message : t("ai.context-estimate-failed"));
      } finally {
        if (requestIdRef.current === requestId) {
          setIsEstimating(false);
        }
      }
    }, ESTIMATE_DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
  }, [filter, isConfigured, t]);

  const toggleTag = useCallback((tag: string) => {
    setSelectedTags((previous) => (previous.includes(tag) ? previous.filter((item) => item !== tag) : [...previous, tag]));
  }, []);

  const clearTags = useCallback(() => setSelectedTags([]), []);

  // Retires a proposal once the user applies or discards it, so a settled
  // proposal cannot be applied twice.
  const handleProposalResolved = useCallback(
    (messageId: string, proposalId: string) => resolveProposal(messageId, proposalId),
    [resolveProposal],
  );

  const overBudget = estimate !== undefined && !estimate.fits;
  const sendDisabled = !isConfigured || overBudget || estimateError !== undefined;
  const sendDisabledReason = !isConfigured
    ? t("ai.not-configured")
    : estimateError !== undefined
      ? t("ai.context-estimate-failed")
      : overBudget
        ? t("ai.context-over-budget-send")
        : undefined;

  const handleSend = useCallback(
    (content: string) => {
      void send(content, {
        filter,
      });
    },
    [filter, send],
  );

  if (!isConfigured) {
    return (
      <div className="mx-auto flex max-w-xl flex-col items-center gap-3 px-6 py-16 text-center">
        <SparklesIcon className="size-7 text-muted-foreground/60" strokeWidth={1.8} />
        <h1 className="text-lg font-semibold text-foreground">{t("ai.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("ai.not-configured")}</p>
        <Button
          variant="outline"
          onClick={() => {
            void fetchSetting(InstanceSetting_Key.AI);
          }}
          render={
            <Link to={`${ROUTES.SETTING}?section=ai`}>
              <SettingsIcon className="me-1.5 size-4" strokeWidth={2} />
              {t("ai.open-settings")}
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 lg:flex-row">
      <aside className="flex min-h-0 shrink-0 flex-col border-border lg:w-72 lg:border-e lg:pe-4">
        <ContextRail
          availableTags={availableTags}
          selectedTags={selectedTags}
          onToggleTag={toggleTag}
          onClearTags={clearTags}
          memoCount={estimate?.memoCount ?? 0}
          estimatedTokens={estimate?.estimatedTokens ?? 0}
          budgetTokens={estimate?.budgetTokens ?? Number(chatConfig?.contextBudgetTokens ?? 0n)}
          isEstimating={isEstimating}
          estimateError={estimateError}
        />
      </aside>

      <section className="flex min-h-0 min-w-0 flex-1 flex-col gap-3">
        <header className="flex flex-wrap items-center gap-2">
          <h1 className="text-base font-semibold text-foreground">{t("ai.title")}</h1>
          <span className="font-mono text-xs text-muted-foreground">{model}</span>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto [scrollbar-width:thin]">
          <ChatThread messages={messages} isSending={isSending} onProposalResolved={handleProposalResolved} />
        </div>

        <ChatComposer isSending={isSending} disabled={sendDisabled} disabledReason={sendDisabledReason} onSend={handleSend} />
      </section>
    </div>
  );
};

export default AIHub;
