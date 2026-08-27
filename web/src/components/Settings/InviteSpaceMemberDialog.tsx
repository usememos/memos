import { create } from "@bufbuild/protobuf";
import { CheckIcon, LoaderCircleIcon, SearchIcon } from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
import toast from "react-hot-toast";
import UserAvatar from "@/components/UserAvatar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCreateSpaceInvitation } from "@/hooks/useSpaceQueries";
import { useUsersByUsernames } from "@/hooks/useUserQueries";
import { handleError } from "@/lib/error";
import { extractSpaceUidFromName } from "@/lib/space-display";
import { type Space, SpaceInvitationSchema, SpaceMember_Role } from "@/types/proto/api/v1/space_service_pb";
import { useTranslate } from "@/utils/i18n";

const LOOKUP_DELAY_MS = 300;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  space: Space;
  viewerName: string;
  memberUserNames: Set<string>;
  pendingInviteeNames: Set<string>;
}

const InviteSpaceMemberDialog = ({ open, onOpenChange, space, viewerName, memberUserNames, pendingInviteeNames }: Props) => {
  const t = useTranslate();
  const spaceUid = extractSpaceUidFromName(space.name);
  const createInvitation = useCreateSpaceInvitation(viewerName);
  const [query, setQuery] = useState("");
  const [lookupUsername, setLookupUsername] = useState("");
  const [selectedUserName, setSelectedUserName] = useState("");
  const [role, setRole] = useState(SpaceMember_Role.USER);
  const roleOptions = [
    { value: String(SpaceMember_Role.USER), label: t("setting.spaces.space-user") },
    { value: String(SpaceMember_Role.ADMIN), label: t("setting.spaces.space-admin") },
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
      toast.success(t("setting.spaces.invite-success", { username: candidate.username }));
      onOpenChange(false);
    } catch (error) {
      handleError(error, toast.error, { context: "Create space invitation" });
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
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent size="sm" data-critical-surface="invite-member-dialog">
        <form className="grid gap-4" onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{t("setting.spaces.invite-to", { space: space.title })}</DialogTitle>
            <DialogDescription>
              {t("setting.spaces.invite-description")}
              <span className="mt-1 block text-xs">
                {t("space.custom-id-label")}: <span className="break-all font-mono">{spaceUid}</span>
              </span>
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-2">
            <Label htmlFor="space-member-search">{t("setting.spaces.memos-user")}</Label>
            <div className="relative">
              <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="space-member-search"
                value={query}
                onChange={(event) => handleQueryChange(event.target.value)}
                autoFocus
                autoComplete="off"
                placeholder={t("setting.spaces.search-user-placeholder")}
                className="pl-8"
              />
              {normalizedUsername && (!lookupSettled || usersQuery.isFetching) ? (
                <LoaderCircleIcon className="absolute right-2.5 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
              ) : null}
            </div>

            {candidate && lookupSettled ? (
              <button
                type="button"
                disabled={!isCandidateAvailable}
                aria-pressed={isSelected}
                onClick={() => setSelectedUserName(isSelected ? "" : candidate.name)}
                className={
                  isSelected
                    ? "flex w-full items-center gap-3 rounded-lg border border-primary/35 bg-primary/5 px-3 py-2 text-left transition-colors"
                    : "flex w-full items-center gap-3 rounded-lg border border-border px-3 py-2 text-left transition-colors hover:bg-muted/40 disabled:cursor-not-allowed disabled:opacity-60"
                }
              >
                <UserAvatar className="size-8 rounded-lg" avatarUrl={candidate.avatarUrl} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{candidate.displayName || `@${candidate.username}`}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    @{candidate.username} · {resultStatus}
                  </p>
                </div>
                {isSelected ? <CheckIcon className="size-4 shrink-0 text-primary" /> : null}
              </button>
            ) : null}

            {normalizedUsername && lookupSettled && usersQuery.isSuccess && !candidate ? (
              <p className="text-xs leading-5 text-muted-foreground">
                {t("setting.spaces.user-not-found", { username: normalizedUsername })}
              </p>
            ) : null}
          </div>

          <div className="grid gap-2">
            <Label>{t("common.role")}</Label>
            <Select value={String(role)} items={roleOptions} onValueChange={(value) => setRole(Number(value) as SpaceMember_Role)}>
              <SelectTrigger className="w-full" aria-label={t("common.role")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={String(SpaceMember_Role.USER)}>{t("setting.spaces.space-user")}</SelectItem>
                <SelectItem value={String(SpaceMember_Role.ADMIN)}>{t("setting.spaces.space-admin")}</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs leading-5 text-muted-foreground">
              {role === SpaceMember_Role.ADMIN ? t("setting.spaces.admin-role-description") : t("setting.spaces.user-role-description")}
            </p>
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" disabled={createInvitation.isPending} onClick={() => onOpenChange(false)}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={!isSelected || !isCandidateAvailable || createInvitation.isPending}>
              {t("setting.spaces.send-invitation")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default InviteSpaceMemberDialog;
