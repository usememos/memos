import {
  ArrowLeftIcon,
  ChevronRightIcon,
  Clock3Icon,
  LoaderCircleIcon,
  LogOutIcon,
  PlusIcon,
  ShieldCheckIcon,
  Trash2Icon,
  UserPlusIcon,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { useNavigate, useSearchParams } from "react-router-dom";
import ConfirmDialog from "@/components/ConfirmDialog";
import CreateSpaceDialog from "@/components/CreateSpaceDialog";
import InviteSpaceMemberDialog from "@/components/Settings/InviteSpaceMemberDialog";
import SettingSection from "@/components/Settings/SettingSection";
import SpaceMark from "@/components/SpaceMark";
import SpaceRoleBadge from "@/components/SpaceRoleBadge";
import UserAvatar from "@/components/UserAvatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import useCurrentUser from "@/hooks/useCurrentUser";
import {
  useAcceptSpaceInvitation,
  useDeclineSpaceInvitation,
  useDeleteSpace,
  useDeleteSpaceInvitation,
  useDeleteSpaceMember,
  useSpaceInvitations,
  useSpaceMembers,
  useSpaces,
  useUpdateSpace,
  useUpdateSpaceMember,
  useUserSpaceInvitations,
} from "@/hooks/useSpaceQueries";
import { useUsersByUsernames } from "@/hooks/useUserQueries";
import { handleError } from "@/lib/error";
import { extractUsernameFromName } from "@/lib/resource-names";
import { extractSpaceUidFromName } from "@/lib/space-display";
import { ROUTES } from "@/router/routes";
import { type Space, type SpaceInvitation, type SpaceMember, SpaceMember_Role } from "@/types/proto/api/v1/space_service_pb";
import type { User } from "@/types/proto/api/v1/user_service_pb";
import { useTranslate } from "@/utils/i18n";

type DetailTab = "general" | "members";

const getSpacesSettingsLocation = (spaceName?: string) => ({
  pathname: ROUTES.SETTING,
  search: spaceName ? `?${new URLSearchParams({ space: spaceName }).toString()}` : "",
  hash: "#spaces",
});

const MemberIdentity = ({ member, user, isCurrentUser }: { member: SpaceMember; user?: User; isCurrentUser?: boolean }) => {
  const t = useTranslate();
  const username = user?.username || extractUsernameFromName(member.user);
  const displayName = user?.displayName || `@${username}`;

  return (
    <div className="flex min-w-0 items-center gap-3">
      <UserAvatar className="size-10 rounded-xl" avatarUrl={user?.avatarUrl} />
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-1.5">
          <p className="truncate text-sm font-medium">{displayName}</p>
          {isCurrentUser ? <span className="text-xs text-muted-foreground">{t("setting.spaces.you")}</span> : null}
        </div>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">@{username}</p>
      </div>
    </div>
  );
};

const InvitationIdentity = ({ invitation, user }: { invitation: SpaceInvitation; user?: User }) => {
  const username = user?.username || extractUsernameFromName(invitation.invitee);
  const displayName = user?.displayName || `@${username}`;

  return (
    <div className="flex min-w-0 items-center gap-3">
      <UserAvatar className="size-10 rounded-xl" avatarUrl={user?.avatarUrl} />
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{displayName}</p>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">@{username}</p>
      </div>
    </div>
  );
};

const SpacesSection = () => {
  const t = useTranslate();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const currentUser = useCurrentUser();
  const viewerName = currentUser?.name ?? "";
  const managedSpaceName = searchParams.get("space") ?? "";
  const spacesQuery = useSpaces(viewerName);
  const receivedInvitationsQuery = useUserSpaceInvitations(viewerName);
  const spaces = spacesQuery.data ?? [];
  const receivedInvitations = receivedInvitationsQuery.data ?? [];
  const managedSpace = spaces.find((space) => space.name === managedSpaceName);
  const [createOpen, setCreateOpen] = useState(false);
  const acceptInvitation = useAcceptSpaceInvitation(viewerName);
  const declineInvitation = useDeclineSpaceInvitation(viewerName);

  useEffect(() => {
    if (managedSpaceName && spacesQuery.isSuccess && !managedSpace) {
      navigate(getSpacesSettingsLocation(), { replace: true });
    }
  }, [managedSpace, managedSpaceName, navigate, spacesQuery.isSuccess]);

  const handleOpenSpace = (spaceName: string) => {
    navigate(getSpacesSettingsLocation(spaceName));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleAcceptInvitation = async (invitation: SpaceInvitation) => {
    try {
      await acceptInvitation.mutateAsync({ name: invitation.name });
      const spaceLabel = invitation.space
        ? `${invitation.space.title} (${extractSpaceUidFromName(invitation.space.name)})`
        : t("setting.spaces.label");
      toast.success(t("setting.spaces.accept-success", { space: spaceLabel }));
    } catch (error) {
      handleError(error, toast.error, { context: "Accept space invitation" });
    }
  };

  const handleDeclineInvitation = async (invitation: SpaceInvitation) => {
    try {
      await declineInvitation.mutateAsync({ name: invitation.name });
      toast.success(t("setting.spaces.decline-success"));
    } catch (error) {
      handleError(error, toast.error, { context: "Decline space invitation" });
    }
  };

  if (managedSpaceName && !managedSpace && spacesQuery.isLoading) {
    return (
      <SettingSection title={t("setting.spaces.title")} description={t("setting.spaces.description")}>
        <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
          <LoaderCircleIcon className="size-4 animate-spin" />
          {t("setting.spaces.loading")}
        </div>
      </SettingSection>
    );
  }

  return managedSpace ? (
    <SpaceDetail
      key={managedSpace.name}
      space={managedSpace}
      viewerName={viewerName}
      onBack={() => navigate(getSpacesSettingsLocation())}
    />
  ) : (
    <>
      <SettingSection
        title={t("setting.spaces.title")}
        description={t("setting.spaces.description")}
        actions={
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <PlusIcon data-icon="inline-start" />
            {t("setting.spaces.create-space")}
          </Button>
        }
        className="gap-5"
      >
        <div data-critical-surface="spaces-overview" className="flex min-w-0 flex-col gap-5">
          {receivedInvitations.length > 0 ? (
            <section aria-labelledby="space-invitations-heading" className="space-y-2.5">
              <div className="flex items-center justify-between">
                <h4 id="space-invitations-heading" className="text-sm font-medium">
                  {t("setting.spaces.invitations")}
                </h4>
                <span className="text-xs text-muted-foreground">
                  {t("setting.spaces.pending-count", { count: receivedInvitations.length })}
                </span>
              </div>
              <div className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-background">
                {receivedInvitations.map((invitation) => {
                  const uid = invitation.space ? extractSpaceUidFromName(invitation.space.name) : "";
                  const title = invitation.space?.title || t("setting.spaces.untitled");

                  return (
                    <div key={invitation.name} className="flex min-w-0 flex-col gap-3 px-3 py-3 sm:flex-row sm:items-center">
                      <div className="flex min-w-0 flex-1 items-center gap-3">
                        <SpaceMark size="lg" />
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="truncate text-sm font-medium">{title}</p>
                            <SpaceRoleBadge role={invitation.role} />
                          </div>
                          {uid ? (
                            <p className="mt-0.5 flex min-w-0 items-baseline gap-1 text-[11px] text-muted-foreground">
                              <span className="shrink-0">{t("space.custom-id-label")}:</span>
                              <span title={uid} className="min-w-0 break-all font-mono">
                                {uid}
                              </span>
                            </p>
                          ) : null}
                          <p className="mt-1 truncate text-xs leading-5 text-muted-foreground">
                            {invitation.space?.description || t("setting.spaces.invited-to-join")}
                          </p>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label={uid ? `${t("setting.spaces.decline")} ${title} (${uid})` : undefined}
                          disabled={acceptInvitation.isPending || declineInvitation.isPending}
                          onClick={() => void handleDeclineInvitation(invitation)}
                        >
                          {t("setting.spaces.decline")}
                        </Button>
                        <Button
                          size="sm"
                          aria-label={uid ? `${t("setting.spaces.accept")} ${title} (${uid})` : undefined}
                          disabled={acceptInvitation.isPending || declineInvitation.isPending}
                          onClick={() => void handleAcceptInvitation(invitation)}
                        >
                          {t("setting.spaces.accept")}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ) : null}

          <section aria-labelledby="your-spaces-heading" className="space-y-2.5">
            <div className="flex items-center justify-between">
              <h4 id="your-spaces-heading" className="text-sm font-medium">
                {t("setting.spaces.your-spaces")}
              </h4>
              {spaces.length > 0 ? (
                <span className="text-xs text-muted-foreground">
                  {spaces.length === 1
                    ? t("setting.spaces.space-count", { count: spaces.length })
                    : t("setting.spaces.spaces-count", { count: spaces.length })}
                </span>
              ) : null}
            </div>
            {spacesQuery.isLoading ? (
              <div className="flex items-center justify-center gap-2 rounded-lg border border-border py-10 text-sm text-muted-foreground">
                <LoaderCircleIcon className="size-4 animate-spin" />
                {t("setting.spaces.loading")}
              </div>
            ) : spacesQuery.isError ? (
              <div className="rounded-lg border border-border px-3 py-8 text-center text-sm text-muted-foreground">
                {t("setting.spaces.load-error")}
              </div>
            ) : spaces.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border px-4 py-9 text-center">
                <p className="text-sm font-medium">{t("setting.spaces.no-spaces")}</p>
                <p className="mx-auto mt-1 max-w-md text-xs leading-5 text-muted-foreground">{t("setting.spaces.no-spaces-description")}</p>
                <Button variant="outline" size="sm" className="mt-4" onClick={() => setCreateOpen(true)}>
                  <PlusIcon data-icon="inline-start" />
                  {t("setting.spaces.create-space")}
                </Button>
              </div>
            ) : (
              <div className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-background">
                {spaces.map((space) => {
                  const uid = extractSpaceUidFromName(space.name);
                  const manageLabel = t("setting.spaces.manage-space", { space: space.title });

                  return (
                    <button
                      key={space.name}
                      type="button"
                      aria-label={uid ? `${manageLabel} (${uid})` : manageLabel}
                      onClick={() => handleOpenSpace(space.name)}
                      className="group flex w-full min-w-0 items-center gap-3 px-3 py-3 text-left transition-colors hover:bg-muted/35 focus-visible:bg-muted/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/45"
                    >
                      <SpaceMark size="lg" />
                      <div className="min-w-0 flex-1">
                        <div className="flex min-w-0 flex-wrap items-center gap-2">
                          <p className="truncate text-sm font-medium">{space.title}</p>
                          <SpaceRoleBadge role={space.currentUserRole} />
                        </div>
                        <p className="mt-0.5 flex min-w-0 items-baseline gap-1 text-[11px] text-muted-foreground">
                          <span className="shrink-0">{t("space.custom-id-label")}:</span>
                          <span title={uid} className="min-w-0 break-all font-mono">
                            {uid}
                          </span>
                        </p>
                        <p className="mt-1 truncate text-xs text-muted-foreground">
                          {space.description || t("setting.spaces.no-description")}
                        </p>
                      </div>
                      <span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">
                        {space.memberCount === 1
                          ? t("setting.spaces.member-count", { count: space.memberCount })
                          : t("setting.spaces.members-count", { count: space.memberCount })}
                      </span>
                      <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground/65 transition-transform group-hover:translate-x-0.5" />
                    </button>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </SettingSection>

      <CreateSpaceDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={(space) => navigate(getSpacesSettingsLocation(space.name))}
        note={t("setting.spaces.create-scope-note")}
      />
    </>
  );
};

interface SpaceDetailProps {
  space: Space;
  viewerName: string;
  onBack: () => void;
}

const SpaceDetail = ({ space, viewerName, onBack }: SpaceDetailProps) => {
  const t = useTranslate();
  const membersQuery = useSpaceMembers(viewerName, space.name);
  const members = membersQuery.data ?? [];
  const currentMember = members.find((member) => member.user === viewerName);
  const currentRole = currentMember?.role ?? space.currentUserRole;
  const isAdmin = currentRole === SpaceMember_Role.ADMIN;
  const invitationsQuery = useSpaceInvitations(viewerName, space.name, { enabled: isAdmin });
  const invitations = invitationsQuery.data ?? [];
  const usernames = useMemo(
    () =>
      Array.from(
        new Set(
          [...members.map((member) => member.user), ...invitations.map((invitation) => invitation.invitee)].map(extractUsernameFromName),
        ),
      ),
    [invitations, members],
  );
  const usersQuery = useUsersByUsernames(usernames);
  const usersByUsername = usersQuery.data ?? new Map<string, User | undefined>();
  const [tab, setTab] = useState<DetailTab>("general");
  const [title, setTitle] = useState(space.title);
  const [description, setDescription] = useState(space.description);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<SpaceMember>();
  const [cancelInvitationTarget, setCancelInvitationTarget] = useState<SpaceInvitation>();
  const updateSpace = useUpdateSpace(viewerName);
  const deleteSpace = useDeleteSpace(viewerName);
  const updateMember = useUpdateSpaceMember(viewerName);
  const deleteMember = useDeleteSpaceMember(viewerName);
  const deleteInvitation = useDeleteSpaceInvitation(viewerName);
  const activeAdminCount = members.filter((member) => member.role === SpaceMember_Role.ADMIN).length;
  const isLastAdmin = currentRole === SpaceMember_Role.ADMIN && activeAdminCount === 1;
  const memberUserNames = useMemo(() => new Set(members.map((member) => member.user)), [members]);
  const pendingInviteeNames = useMemo(() => new Set(invitations.map((invitation) => invitation.invitee)), [invitations]);
  const roleOptions = [
    { value: String(SpaceMember_Role.USER), label: t("setting.spaces.space-user") },
    { value: String(SpaceMember_Role.ADMIN), label: t("setting.spaces.space-admin") },
  ];
  const detailsChanged = title.trim() !== space.title || description.trim() !== space.description;
  const spaceUid = extractSpaceUidFromName(space.name);
  const disambiguatedSpaceTitle = `${space.title} (${spaceUid})`;

  useEffect(() => {
    setTitle(space.title);
    setDescription(space.description);
  }, [space.description, space.title]);

  const handleSave = async () => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle || !isAdmin || updateSpace.isPending) return;
    try {
      await updateSpace.mutateAsync({
        space: { name: space.name, title: trimmedTitle, description: description.trim() },
        updateMask: ["title", "description"],
      });
      toast.success(t("setting.spaces.save-success"));
    } catch (error) {
      handleError(error, toast.error, { context: "Update space" });
    }
  };

  const handleRoleChange = async (member: SpaceMember, role: SpaceMember_Role) => {
    if (member.role === role || updateMember.isPending) return;
    try {
      await updateMember.mutateAsync({ spaceMember: { name: member.name, role }, updateMask: ["role"] });
      toast.success(t("setting.spaces.role-update-success"));
    } catch (error) {
      handleError(error, toast.error, { context: "Update space member" });
    }
  };

  const handleRemoveMember = async () => {
    if (!removeTarget) return;
    try {
      await deleteMember.mutateAsync({ name: removeTarget.name });
      toast.success(t("setting.spaces.remove-success", { username: extractUsernameFromName(removeTarget.user) }));
      setRemoveTarget(undefined);
    } catch (error) {
      handleError(error, toast.error, { context: "Remove space member" });
      throw error;
    }
  };

  const handleCancelInvitation = async () => {
    if (!cancelInvitationTarget) return;
    try {
      await deleteInvitation.mutateAsync({ name: cancelInvitationTarget.name });
      toast.success(t("setting.spaces.cancel-invitation-success"));
      setCancelInvitationTarget(undefined);
    } catch (error) {
      handleError(error, toast.error, { context: "Cancel space invitation" });
      throw error;
    }
  };

  const handleLeave = async () => {
    if (!currentMember) return;
    try {
      await deleteMember.mutateAsync({ name: currentMember.name });
      toast.success(t("setting.spaces.leave-success", { space: disambiguatedSpaceTitle }));
      onBack();
    } catch (error) {
      handleError(error, toast.error, { context: "Leave space" });
      throw error;
    }
  };

  const handleDeleteSpace = async () => {
    try {
      await deleteSpace.mutateAsync({ name: space.name });
      toast.success(t("setting.spaces.delete-success", { space: disambiguatedSpaceTitle }));
      onBack();
    } catch (error) {
      handleError(error, toast.error, { context: "Delete space" });
      throw error;
    }
  };

  return (
    <section className="min-w-0">
      <button
        type="button"
        onClick={onBack}
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeftIcon className="size-4" />
        {t("setting.spaces.label")}
      </button>

      <header className="flex min-w-0 flex-col gap-3 border-b border-border/70 pb-4 sm:flex-row sm:items-center">
        <SpaceMark size="xl" />
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <h3 className="truncate text-lg font-semibold tracking-tight">{space.title}</h3>
            <SpaceRoleBadge role={currentRole} />
          </div>
          <p className="mt-1 flex min-w-0 items-baseline gap-1 text-xs text-muted-foreground">
            <span className="shrink-0">{t("space.custom-id-label")}:</span>
            <span title={spaceUid} className="min-w-0 break-all font-mono">
              {spaceUid}
            </span>
          </p>
          <p className="mt-1 truncate text-sm text-muted-foreground">{space.description || t("setting.spaces.no-description")}</p>
        </div>
      </header>

      <Tabs value={tab} onValueChange={(value) => setTab(value as DetailTab)} variant="underline" className="mt-2">
        <TabsList className="w-full justify-start border-b border-border/70">
          <TabsTrigger value="general" className="flex-none px-3">
            {t("setting.spaces.general")}
          </TabsTrigger>
          <TabsTrigger value="members" className="flex-none px-3">
            {t("setting.spaces.members")}
            <span className="text-xs font-normal text-muted-foreground">{members.length || space.memberCount}</span>
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {tab === "general" ? (
        <div className="space-y-5 pt-3">
          <section className="space-y-2.5">
            <div>
              <h4 className="text-sm font-medium">{t("setting.spaces.space-details")}</h4>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">{t("setting.spaces.space-details-description")}</p>
            </div>
            <div className="overflow-hidden rounded-lg border border-border bg-background">
              <div className="grid gap-2 border-b border-border px-3 py-3 sm:grid-cols-[170px_1fr] sm:items-center">
                <span className="text-sm font-medium">{t("space.custom-id-label")}</span>
                <code className="min-w-0 break-all rounded-md bg-muted/35 px-3 py-2 font-mono text-xs leading-5 text-foreground/85">
                  {spaceUid}
                </code>
              </div>
              <div className="grid gap-2 border-b border-border px-3 py-3 sm:grid-cols-[170px_1fr] sm:items-center">
                <Label htmlFor="space-settings-title">{t("common.name")}</Label>
                <Input
                  id="space-settings-title"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  readOnly={!isAdmin}
                  className={!isAdmin ? "bg-muted/25" : undefined}
                />
              </div>
              <div className="grid gap-2 px-3 py-3 sm:grid-cols-[170px_1fr] sm:items-start">
                <div>
                  <Label htmlFor="space-settings-description">{t("common.description")}</Label>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">{t("setting.spaces.description-help")}</p>
                </div>
                <Textarea
                  id="space-settings-description"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  readOnly={!isAdmin}
                  className={isAdmin ? "min-h-20 resize-none" : "min-h-20 resize-none bg-muted/25"}
                />
              </div>
              {isAdmin ? (
                <div className="flex justify-end border-t border-border bg-muted/20 px-3 py-2.5">
                  <Button size="sm" disabled={!title.trim() || !detailsChanged || updateSpace.isPending} onClick={() => void handleSave()}>
                    {t("setting.spaces.save-changes")}
                  </Button>
                </div>
              ) : null}
            </div>
          </section>

          <section className="space-y-2.5">
            <h4 className="text-sm font-medium">{t("setting.spaces.your-access")}</h4>
            <div className="flex flex-col gap-3 rounded-lg border border-border px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-2">
                <ShieldCheckIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">{t("setting.spaces.role-in-space")}</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    {isAdmin ? t("setting.spaces.admin-role-description") : t("setting.spaces.user-role-description")}
                  </p>
                </div>
              </div>
              <SpaceRoleBadge role={currentRole} />
            </div>
          </section>

          <section className="rounded-xl border border-destructive/30 bg-destructive/5 p-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex min-w-0 items-start gap-3">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                  <LogOutIcon className="size-4" />
                </span>
                <div>
                  <h4 className="text-sm font-medium">{t("setting.spaces.leave-space")}</h4>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    {isLastAdmin ? t("setting.spaces.last-admin-leave-description") : t("setting.spaces.leave-description")}
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                disabled={!currentMember || isLastAdmin}
                className="border-destructive/35 text-destructive hover:bg-destructive/10"
                onClick={() => setLeaveOpen(true)}
              >
                {t("setting.spaces.leave-space")}
              </Button>
            </div>
            {isAdmin ? (
              <div className="mt-4 flex flex-col gap-4 border-t border-destructive/20 pt-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex min-w-0 items-start gap-3">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                    <Trash2Icon className="size-4" />
                  </span>
                  <div>
                    <h4 className="text-sm font-medium">{t("setting.spaces.delete-space")}</h4>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">{t("setting.spaces.delete-description")}</p>
                  </div>
                </div>
                <Button variant="destructive" size="sm" onClick={() => setDeleteOpen(true)}>
                  {t("setting.spaces.delete-space")}
                </Button>
              </div>
            ) : null}
          </section>
        </div>
      ) : (
        <div data-critical-surface="space-members" className="space-y-5 pt-3">
          <section className="space-y-2.5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h4 className="text-sm font-medium">{t("setting.spaces.members")}</h4>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">{t("setting.spaces.members-description")}</p>
              </div>
              {isAdmin ? (
                <Button size="sm" onClick={() => setInviteOpen(true)}>
                  <UserPlusIcon data-icon="inline-start" />
                  {t("setting.spaces.invite-member")}
                </Button>
              ) : null}
            </div>

            <div className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-background">
              {membersQuery.isLoading ? (
                <div className="flex items-center justify-center gap-2 px-3 py-8 text-sm text-muted-foreground">
                  <LoaderCircleIcon className="size-4 animate-spin" />
                  {t("setting.spaces.loading-members")}
                </div>
              ) : membersQuery.isError ? (
                <div className="px-3 py-8 text-center text-sm text-muted-foreground">{t("setting.spaces.members-load-error")}</div>
              ) : (
                members.map((member) => {
                  const isCurrentUser = member.user === viewerName;
                  return (
                    <div key={member.name} className="grid min-w-0 gap-3 px-3 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                      <MemberIdentity
                        member={member}
                        user={usersByUsername.get(extractUsernameFromName(member.user))}
                        isCurrentUser={isCurrentUser}
                      />
                      <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
                        {isAdmin && !isCurrentUser ? (
                          <Select
                            value={String(member.role)}
                            items={roleOptions}
                            disabled={updateMember.isPending}
                            onValueChange={(value) => void handleRoleChange(member, Number(value) as SpaceMember_Role)}
                          >
                            <SelectTrigger
                              size="sm"
                              className="w-[126px] rounded-md"
                              aria-label={t("setting.spaces.change-role", { username: extractUsernameFromName(member.user) })}
                            >
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent align="end">
                              <SelectItem value={String(SpaceMember_Role.USER)}>{t("setting.spaces.space-user")}</SelectItem>
                              <SelectItem value={String(SpaceMember_Role.ADMIN)}>{t("setting.spaces.space-admin")}</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : (
                          <SpaceRoleBadge role={member.role} />
                        )}
                        {isAdmin && !isCurrentUser ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-muted-foreground hover:text-destructive"
                            onClick={() => setRemoveTarget(member)}
                          >
                            {t("setting.spaces.remove")}
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </section>

          {isAdmin ? (
            <section className="space-y-2.5">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium">{t("setting.spaces.pending-invitations")}</h4>
                <span className="text-xs text-muted-foreground">{invitations.length}</span>
              </div>
              <div className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-background">
                {invitationsQuery.isLoading ? (
                  <div className="flex items-center justify-center gap-2 px-3 py-5 text-sm text-muted-foreground">
                    <LoaderCircleIcon className="size-4 animate-spin" />
                    {t("setting.spaces.loading-invitations")}
                  </div>
                ) : invitations.length === 0 ? (
                  <div className="px-3 py-5 text-center text-sm text-muted-foreground">{t("setting.spaces.no-pending-invitations")}</div>
                ) : (
                  invitations.map((invitation) => (
                    <div key={invitation.name} className="grid min-w-0 gap-3 px-3 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                      <InvitationIdentity invitation={invitation} user={usersByUsername.get(extractUsernameFromName(invitation.invitee))} />
                      <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
                        <Badge variant="warning" shape="pill" className="h-5 px-2 font-normal">
                          <Clock3Icon data-icon="inline-start" />
                          {t("setting.spaces.invitation-pending")}
                        </Badge>
                        <SpaceRoleBadge role={invitation.role} />
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-muted-foreground hover:text-destructive"
                          onClick={() => setCancelInvitationTarget(invitation)}
                        >
                          {t("setting.spaces.cancel-invitation")}
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>
          ) : null}
        </div>
      )}

      <InviteSpaceMemberDialog
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        space={space}
        viewerName={viewerName}
        memberUserNames={memberUserNames}
        pendingInviteeNames={pendingInviteeNames}
      />

      <ConfirmDialog
        open={leaveOpen}
        onOpenChange={setLeaveOpen}
        title={
          <span className="[overflow-wrap:anywhere]">{t("setting.spaces.leave-confirm-title", { space: disambiguatedSpaceTitle })}</span>
        }
        description={t("setting.spaces.leave-confirm-description")}
        confirmLabel={t("setting.spaces.leave")}
        cancelLabel={t("common.cancel")}
        onConfirm={handleLeave}
        confirmVariant="destructive"
      />
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={
          <span className="[overflow-wrap:anywhere]">{t("setting.spaces.delete-confirm-title", { space: disambiguatedSpaceTitle })}</span>
        }
        description={t("setting.spaces.delete-confirm-description")}
        confirmLabel={t("common.delete")}
        cancelLabel={t("common.cancel")}
        onConfirm={handleDeleteSpace}
        confirmVariant="destructive"
      />
      <ConfirmDialog
        open={Boolean(removeTarget)}
        onOpenChange={(open) => !open && setRemoveTarget(undefined)}
        title={t("setting.spaces.remove-confirm-title", { username: extractUsernameFromName(removeTarget?.user ?? "") })}
        description={t("setting.spaces.remove-confirm-description")}
        confirmLabel={t("setting.spaces.remove")}
        cancelLabel={t("common.cancel")}
        onConfirm={handleRemoveMember}
        confirmVariant="destructive"
      />
      <ConfirmDialog
        open={Boolean(cancelInvitationTarget)}
        onOpenChange={(open) => !open && setCancelInvitationTarget(undefined)}
        title={t("setting.spaces.cancel-invitation-confirm-title", {
          username: extractUsernameFromName(cancelInvitationTarget?.invitee ?? ""),
        })}
        description={t("setting.spaces.cancel-invitation-confirm-description")}
        confirmLabel={t("setting.spaces.cancel-invitation")}
        cancelLabel={t("common.cancel")}
        onConfirm={handleCancelInvitation}
        confirmVariant="destructive"
      />
    </section>
  );
};

export default SpacesSection;
