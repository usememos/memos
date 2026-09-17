import { create } from "@bufbuild/protobuf";
import { CheckIcon, ExternalLinkIcon, PencilIcon, XIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "react-hot-toast";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useCreateMemo, useUpdateMemo } from "@/hooks/useMemoQueries";
import { handleError } from "@/lib/error";
import { cn } from "@/lib/utils";
import { type ChatProposal, ChatProposalAction } from "@/types/proto/api/v1/ai_service_pb";
import { MemoSchema, Visibility } from "@/types/proto/api/v1/memo_service_pb";
import { useTranslate } from "@/utils/i18n";

interface ProposalCardProps {
  proposal: ChatProposal;
  /** Called after the note was written, so the parent can retire the card. */
  onApplied: () => void;
  onDiscarded: () => void;
}

/** Extracts the memo uid from a resource name like "memos/abc123". */
const extractMemoUid = (name: string): string => name.replace(/^memos\//, "").trim();

/**
 * Renders one proposed note change. The model never writes: this card is the
 * only place a proposal becomes a real memo, and only after the user confirms.
 * Edits happen in a plain textarea over the full proposed content, so the user
 * approves exactly the text that will be saved.
 */
const ProposalCard = ({ proposal, onApplied, onDiscarded }: ProposalCardProps) => {
  const t = useTranslate();
  const createMemo = useCreateMemo();
  const updateMemo = useUpdateMemo();

  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(proposal.content);
  const [appliedName, setAppliedName] = useState<string | undefined>();
  const [isApplying, setIsApplying] = useState(false);

  const isUpdate = proposal.action === ChatProposalAction.UPDATE;
  const targetUid = extractMemoUid(proposal.target);
  // An update without a usable target cannot be applied, so the card degrades to
  // showing the proposal text rather than offering a broken action.
  const canApply = !isUpdate || (targetUid !== "" && proposal.targetContent !== undefined);
  const content = isEditing ? draft : proposal.content;

  const handleApply = async () => {
    const trimmed = content.trim();
    if (trimmed === "") {
      toast.error(t("ai.proposal-empty-content"));
      return;
    }

    setIsApplying(true);
    try {
      if (isUpdate) {
        const memo = await updateMemo.mutateAsync({
          update: { name: `memos/${targetUid}`, content: trimmed },
          updateMask: ["content"],
          expectedContent: proposal.targetContent,
        });
        setAppliedName(memo.name);
      } else {
        const memo = await createMemo.mutateAsync(
          create(MemoSchema, {
            content: trimmed,
            // Notes the model drafts are private until the user decides
            // otherwise, matching the composer's default.
            visibility: Visibility.PRIVATE,
          }),
        );
        setAppliedName(memo.name);
      }
      setIsEditing(false);
      onApplied();
    } catch (error: unknown) {
      await handleError(error, toast.error, { context: isUpdate ? "Update memo from AI proposal" : "Create memo from AI proposal" });
    } finally {
      setIsApplying(false);
    }
  };

  if (appliedName) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm">
        <CheckIcon className="size-4 shrink-0 text-primary" strokeWidth={2} />
        <span className="text-muted-foreground">{isUpdate ? t("ai.proposal-applied-update") : t("ai.proposal-applied-create")}</span>
        <Link to={`/${appliedName}`} className="ms-auto inline-flex items-center gap-1 font-medium text-primary hover:underline">
          {t("ai.proposal-open-note")}
          <ExternalLinkIcon className="size-3" strokeWidth={2} />
        </Link>
      </div>
    );
  }

  return (
    <div className={cn("rounded-lg border border-border bg-background", "overflow-hidden")}>
      <div className="flex flex-wrap items-center gap-2 border-b border-border bg-muted/30 px-3 py-2">
        <span className="rounded-md border border-border bg-background px-2 py-0.5 text-xs font-medium">
          {isUpdate ? t("ai.proposal-update-badge") : t("ai.proposal-create-badge")}
        </span>
        {isUpdate && (
          <span className="font-mono text-xs text-muted-foreground">{canApply ? proposal.target : t("ai.proposal-missing-target")}</span>
        )}
        <span className="ms-auto text-xs text-muted-foreground">{t("ai.proposal-review-hint")}</span>
      </div>

      <div className="px-3 py-2">
        {isEditing ? (
          <Textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            rows={Math.min(20, Math.max(6, draft.split("\n").length + 1))}
            className="font-mono text-sm"
            autoFocus
          />
        ) : (
          <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-words text-sm text-foreground">{content}</pre>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-border px-3 py-2">
        <Button size="sm" disabled={!canApply || isApplying} onClick={handleApply}>
          <CheckIcon className="me-1 size-3.5" strokeWidth={2} />
          {isUpdate ? t("ai.proposal-confirm-update") : t("ai.proposal-confirm-create")}
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={isApplying}
          onClick={() => {
            if (isEditing) {
              // Discard the edit but keep the proposal.
              setDraft(proposal.content);
              setIsEditing(false);
            } else {
              setIsEditing(true);
            }
          }}
        >
          <PencilIcon className="me-1 size-3.5" strokeWidth={2} />
          {isEditing ? t("common.cancel") : t("common.edit")}
        </Button>
        <Button size="sm" variant="ghost" disabled={isApplying} onClick={onDiscarded} className="ms-auto">
          <XIcon className="me-1 size-3.5" strokeWidth={2} />
          {t("ai.proposal-discard")}
        </Button>
      </div>
    </div>
  );
};

export default ProposalCard;
