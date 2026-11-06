import { Tooltip } from "@usememos/ui";
import useCurrentUser from "@/hooks/useCurrentUser";
import { cn } from "@/lib/utils";
import { State } from "@/types/proto/api/common_pb";
import type { Memo } from "@/types/proto/api/memo_service_pb";
import type { User } from "@/types/proto/api/user_service_pb";
import { formatReactionTooltip, useReactionActions } from "./hooks";

/** A reaction is a chip in the Badge's grammar, the same shape and height as a tag. */
const REACTION_PILL_CLASSES = "inline-flex h-5 shrink-0 items-center gap-1.5 rounded-mu-sm bg-mu-well px-1.5 mu-caption text-mu-ink";
const REACTION_PILL_INTERACTIVE_CLASSES = cn(
  REACTION_PILL_CLASSES,
  "cursor-pointer transition-colors hover:bg-mu-hover hover:text-mu-ink aria-pressed:bg-mu-hover aria-pressed:text-mu-ink data-popup-open:bg-mu-hover data-popup-open:text-mu-ink",
  "mu-focus",
);
/** The strip's add control is a control, not a token: a quiet square of the chips' height with no resting surface. */
export const REACTION_ADD_CLASSES = cn(REACTION_PILL_INTERACTIVE_CLASSES, "size-5 justify-center bg-transparent px-0 text-mu-ink-muted");

interface Props {
  memo: Memo;
  reactionType: string;
  users: User[];
}

const ReactionView = (props: Props) => {
  const { memo, reactionType, users } = props;
  const currentUser = useCurrentUser();
  const hasReaction = users.some((user) => currentUser && user.username === currentUser.username);
  const readonly = memo.state === State.ARCHIVED;

  const { handleReactionClick } = useReactionActions({ memo });

  const isClickable = Boolean(currentUser) && !readonly;
  const label = (
    <>
      <span className="mu-body">{reactionType}</span>
      <span className="mu-caption tabular-nums text-mu-ink-muted">{users.length}</span>
    </>
  );

  return (
    <Tooltip.Provider>
      <Tooltip.Root>
        <Tooltip.Trigger
          render={
            isClickable ? (
              <button
                type="button"
                className={REACTION_PILL_INTERACTIVE_CLASSES}
                aria-pressed={hasReaction}
                onClick={() => handleReactionClick(reactionType)}
              />
            ) : (
              <span className={REACTION_PILL_CLASSES} />
            )
          }
        >
          {label}
        </Tooltip.Trigger>
        <Tooltip.Popup>
          <p>{formatReactionTooltip(users, reactionType)}</p>
        </Tooltip.Popup>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
};

export default ReactionView;
