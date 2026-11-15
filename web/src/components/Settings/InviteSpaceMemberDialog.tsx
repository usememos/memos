import { create } from "@bufbuild/protobuf";
import { Button, Dialog, Field, Fieldset, Input, Radio, RadioGroup, Spinner } from "@usememos/ui";
import { CheckIcon, SearchIcon } from "lucide-react";
import { type FormEvent, type RefObject, useEffect, useState } from "react";
import UserAvatar from "@/components/UserAvatar";
import { useCreateSpaceInvitation } from "@/hooks/useSpaceQueries";
import { useUsersByUsernames } from "@/hooks/useUserQueries";
import { handleError } from "@/lib/error";
import { extractSpaceUidFromName } from "@/lib/space-display";
import { showErrorToast, toast } from "@/lib/toast";
import { type Space, SpaceInvitationSchema, SpaceMember_Role } from "@/types/proto/api/space_service_pb";
import { useTranslate } from "@/utils/i18n";

const LOOKUP_DELAY_MS = 300;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  finalFocus?: RefObject<HTMLElement | null>;
  space: Space;
  viewerName: string;
  memberUserNames: Set<string>;
  pendingInviteeNames: Set<string>;
}

const InviteSpaceMemberDialog = ({ open, onOpenChange, finalFocus, space, viewerName, memberUserNames, pendingInviteeNames }: Props) => {
  const t = useTranslate();
  const spaceUid = extractSpaceUidFromName(space.name);
  const createInvitation = useCreateSpaceInvitation(viewerName);
  const [query, setQuery] = useState("");
  const [lookupUsername, setLookupUsername] = useState("");
  const [selectedUserName, setSelectedUserName] = useState("");
  const [role, setRole] = useState(SpaceMember_Role.USER);
  const roleOptions = [
    { value: String(SpaceMember_Role.USER), label: t("setting.spaces.space-user"), description: t("setting.spaces.user-role-description") },
    {
      value: String(SpaceMember_Role.ADMIN),
      label: t("setting.spaces.space-admin"),
      description: t("setting.spaces.admin-role-description"),
    },
  ];
  const normalizedUsername = query.trim().replace(/^@/, "");
  const lookupSettled = lookupUsername === normalizedUsername;
  const usersQuery = useUsersByUsernames(lookupUsername ? [lookupUsername] : [], {
    enabled: open && Boolean(lookupUsername),
  });
  const candidate = lookupUsername ? usersQuery.data?.get(lookupUsername) : undefined;
  const isCurrentUser = candidate?.name === viewerName;
  const isMember = candidate ? memberUserNames.has(candidate.name) : false;
  const isPendingInvitee = candidate ? pendingInviteeNames.has(candidate.name) : false;
  const isCandidateAvailable = Boolean(candidate && !isCurrentUser && !isMember && !isPendingInvitee);
  const isSelected = Boolean(candidate && candidate.name === selectedUserName);

  useEffect(() => {
    const timeout = window.setTimeout(() => setLookupUsername(normalizedUsername), LOOKUP_DELAY_MS);
    return () => window.clearTimeout(timeout);
  }, [normalizedUsername]);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setLookupUsername("");
      setSelectedUserName("");
      setRole(SpaceMember_Role.USER);
    }
  }, [open]);

  const handleQueryChange = (value: string) => {
    setQuery(value);
    setSelectedUserName("");
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && createInvitation.isPending) {
      return;
    }
    onOpenChange(nextOpen);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!candidate || !isSelected || !isCandidateAvailable || createInvitation.isPending) {
      return;
    }

    try {
      await createInvitation.mutateAsync({
        parent: space.name,
        spaceInvitation: create(SpaceInvitationSchema, {
          invitee: candidate.name,
          role,
        }),
      });
      toast.add({ title: t("setting.spaces.invite-success", { username: candidate.username }), type: "success" });
      onOpenChange(false);
    } catch (error) {
      handleError(error, showErrorToast, { context: "Create space invitation" });
    }
  };

  const resultStatus = isCurrentUser
    ? t("setting.spaces.invite-yourself")
    : isMember
      ? t("setting.spaces.already-member")
      : isPendingInvitee
        ? t("setting.spaces.already-invited")
        : t("setting.spaces.active-user");

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Popup data-critical-surface="invite-member-dialog" closeLabel={t("common.close")} finalFocus={finalFocus}>
        <form className="grid gap-4" onSubmit={handleSubmit}>
          <Dialog.Title>{t("setting.spaces.invite-to", { space: space.title })}</Dialog.Title>
          <Dialog.Description>
            {t("setting.spaces.invite-description")}
            <span className="mt-1 block mu-caption">
              {t("space.custom-id-label")}: <span className="break-all font-mono">{spaceUid}</span>
            </span>
          </Dialog.Description>

          <Field.Root>
            <Field.Label>{t("setting.spaces.memos-user")}</Field.Label>
            <Input
              id="space-member-search"
              value={query}
              onChange={(event) => handleQueryChange(event.target.value)}
              autoFocus
              autoComplete="off"
              placeholder={t("setting.spaces.search-user-placeholder")}
              prefix={<SearchIcon />}
              suffix={normalizedUsername && (!lookupSettled || usersQuery.isFetching) ? <Spinner aria-hidden /> : undefined}
            />

            {candidate && lookupSettled ? (
              <button
                type="button"
                disabled={!isCandidateAvailable}
                aria-pressed={isSelected}
                onClick={() => setSelectedUserName(isSelected ? "" : candidate.name)}
                className={
                  isSelected
                    ? "flex w-full items-center gap-3 rounded-mu-lg border border-mu-edge bg-mu-well px-3 py-2 text-left text-mu-text transition-colors mu-focus focus-visible:border-mu-focus"
                    : "flex w-full items-center gap-3 rounded-mu-lg border border-mu-edge px-3 py-2 text-left text-mu-text-secondary transition-colors enabled:hover:bg-mu-hover disabled:cursor-not-allowed disabled:opacity-60 mu-focus focus-visible:border-mu-focus"
                }
              >
                <UserAvatar className="size-8" avatarUrl={candidate.avatarUrl} name={candidate.displayName || candidate.username} />
                <div className="min-w-0 flex-1">
                  <p className="truncate mu-label">{candidate.displayName || `@${candidate.username}`}</p>
                  <p className="truncate mu-caption text-mu-text-secondary">
                    @{candidate.username} · {resultStatus}
                  </p>
                </div>
                {isSelected ? <CheckIcon className="mu-icon shrink-0 text-mu-primary" /> : null}
              </button>
            ) : null}

            {normalizedUsername && lookupSettled && usersQuery.isSuccess && !candidate ? (
              <p className="mu-caption text-mu-text-secondary">{t("setting.spaces.user-not-found", { username: normalizedUsername })}</p>
            ) : null}
          </Field.Root>

          <Field.Root>
            <Fieldset.Root
              render={<RadioGroup value={String(role)} onValueChange={(value) => setRole(Number(value) as SpaceMember_Role)} />}
            >
              <Fieldset.Legend>{t("common.role")}</Fieldset.Legend>
              {roleOptions.map((option) => (
                <Field.Item key={option.value}>
                  <Field.Label className="items-start">
                    <Radio value={option.value} className="mt-0.5" />
                    <span className="flex flex-col gap-0.5">
                      <span className="text-mu-text">{option.label}</span>
                      <span className="mu-caption text-mu-text-secondary">{option.description}</span>
                    </span>
                  </Field.Label>
                </Field.Item>
              ))}
            </Fieldset.Root>
          </Field.Root>

          <Dialog.Footer>
            <Button type="button" variant="ghost" disabled={createInvitation.isPending} onClick={() => onOpenChange(false)}>
              {t("common.cancel")}
            </Button>
            <Button variant="primary" type="submit" disabled={!isSelected || !isCandidateAvailable || createInvitation.isPending}>
              {t("setting.spaces.send-invitation")}
            </Button>
          </Dialog.Footer>
        </form>
      </Dialog.Popup>
    </Dialog.Root>
  );
};

export default InviteSpaceMemberDialog;
