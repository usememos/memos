import { SparklesIcon, TriangleAlertIcon, UserRoundIcon } from "lucide-react";
import type { HubMessage } from "@/hooks/useAiChat";
import { cn } from "@/lib/utils";
import { useTranslate } from "@/utils/i18n";
import ProposalCard from "./ProposalCard";

interface ChatThreadProps {
  messages: HubMessage[];
  isSending: boolean;
  /** Retires one proposal from a message after the user acts on it. */
  onProposalResolved: (messageId: string, proposalId: string) => void;
}

/** Renders the conversation, including the note changes the model proposed. */
const ChatThread = ({ messages, isSending, onProposalResolved }: ChatThreadProps) => {
  const t = useTranslate();

  if (messages.length === 0 && !isSending) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
        <SparklesIcon className="size-6 text-muted-foreground/60" strokeWidth={1.8} />
        <p className="text-sm font-medium text-foreground">{t("ai.empty-title")}</p>
        <p className="max-w-md text-xs text-muted-foreground">{t("ai.empty-description")}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {messages.map((message) => (
        <div key={message.id} className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "flex size-5 shrink-0 items-center justify-center rounded-full border border-border",
                message.role === "user" ? "bg-muted" : "bg-primary/10",
              )}
              aria-hidden
            >
              {message.role === "user" ? (
                <UserRoundIcon className="size-3 text-muted-foreground" strokeWidth={2} />
              ) : (
                <SparklesIcon className="size-3 text-primary" strokeWidth={2} />
              )}
            </span>
            <span className="text-xs font-medium text-muted-foreground">
              {message.role === "user" ? t("ai.role-you") : t("ai.role-assistant")}
            </span>
            {message.role === "assistant" && (
              <span className="text-xs text-muted-foreground/70">
                {message.contextMemoCount === 0 ? t("ai.receipt-no-context") : t("ai.receipt-context", { count: message.contextMemoCount })}
              </span>
            )}
          </div>

          <div className="ps-7">
            <div className="whitespace-pre-wrap break-words text-sm text-foreground">{message.content}</div>

            {message.truncated && (
              <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                <TriangleAlertIcon className="size-3.5" strokeWidth={2} />
                {t("ai.truncated-reply")}
              </p>
            )}

            {message.proposals.length > 0 && (
              <div className="mt-3 flex flex-col gap-2">
                {message.proposals.map((proposal) => (
                  <ProposalCard
                    key={proposal.clientId}
                    proposal={proposal}
                    onApplied={() => onProposalResolved(message.id, proposal.clientId)}
                    onDiscarded={() => onProposalResolved(message.id, proposal.clientId)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      ))}

      {isSending && (
        <div className="flex items-center gap-2 ps-7 text-xs text-muted-foreground">
          <SparklesIcon className="size-3.5 animate-pulse text-primary" strokeWidth={2} />
          {t("ai.thinking")}
        </div>
      )}
    </div>
  );
};

export default ChatThread;
