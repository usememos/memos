import { Badge, Button, Field, Input, List, Select, Skeleton, Tabs, Textarea } from "@usememos/ui";
import { ArrowLeftIcon, ChevronRightIcon, Clock3Icon, PlusIcon, ShieldCheckIcon, UserPlusIcon } from "lucide-react";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import ConfirmDialog from "@/components/ConfirmDialog";
import CreateSpaceDialog from "@/components/CreateSpaceDialog";
import InviteSpaceMemberDialog from "@/components/Settings/InviteSpaceMemberDialog";
import SettingSection from "@/components/Settings/SettingSection";
import SpaceIconPicker from "@/components/SpaceIconPicker";
import SpaceMark from "@/components/SpaceMark";
import SpaceRoleBadge from "@/components/SpaceRoleBadge";
import UserAvatar from "@/components/UserAvatar";
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
import { customIconsEqual } from "@/lib/custom-icons";
import { handleError } from "@/lib/error";
import { extractUsernameFromName } from "@/lib/resource-names";
import { extractSpaceUidFromName } from "@/lib/space-display";
import { showErrorToast, toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { ROUTES } from "@/router/routes";
import { type Space, type SpaceInvitation, type SpaceMember, SpaceMember_Role } from "@/types/proto/api/space_service_pb";
import type { User } from "@/types/proto/api/user_service_pb";
import { useTranslate } from "@/utils/i18n";

type DetailTab = "general" | "members";

const getSpacesSettingsLocation = (spaceName?: string) => ({
  pathname: ROUTES.SETTING,
  search: spaceName ? `?${new URLSearchParams({ space: spaceName }).toString()}` : "",
  hash: "#spaces",
});

/** Three placeholder rows in the shape of a space, member or invitation row. */
const SkeletonList = ({ label }: { label: string }) => (
  <List.Root aria-busy aria-label={label}>
    {[0, 1, 2].map((row) => (
      <List.Item key={row} className="flex items-center gap-3">
        <Skeleton round />
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <Skeleton width="40%" />
          <Skeleton width="25%" height={12} />
        </div>
      </List.Item>
    ))}
  </List.Root>
);

/** Shown in place of a list that has nothing to show: empty, or failed to load. */
const ListMessage = ({ children, className }: { children: ReactNode; className?: string }) => (
  <div className={cn("rounded-mu-lg border border-dashed border-mu-line px-3 text-center mu-body text-mu-text-secondary", className)}>
    {children}
  </div>
);

const MemberIdentity = ({ member, user, isCurrentUser }: { member: SpaceMember; user?: User; isCurrentUser?: boolean }) => {
  const t = useTranslate();
  const username = user?.username || extractUsernameFromName(member.user);
  const displayName = user?.displayName || `@${username}`;

  return (
    <div className="flex min-w-0 items-center gap-3">
      <UserAvatar className="size-10" avatarUrl={user?.avatarUrl} name={displayName} />
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-1.5">
          <p className="truncate mu-label">{displayName}</p>
          {isCurrentUser ? <span className="mu-caption text-mu-text-secondary">{t("setting.spaces.you")}</span> : null}
        </div>
        <p className="mt-0.5 truncate mu-caption text-mu-text-secondary">@{username}</p>
      </div>
    </div>
  );
};

const InvitationIdentity = ({ invitation, user }: { invitation: SpaceInvitation; user?: User }) => {
  const username = user?.username || extractUsernameFromName(invitation.invitee);
  const displayName = user?.displayName || `@${username}`;

  return (
    <div className="flex min-w-0 items-center gap-3">
      <UserAvatar className="size-10" avatarUrl={user?.avatarUrl} name={displayName} />
      <div className="min-w-0">
        <p className="truncate mu-label">{displayName}</p>
        <p className="mt-0.5 truncate mu-caption text-mu-text-secondary">@{username}</p>
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
      toast.add({ title: t("setting.spaces.accept-success", { space: spaceLabel }), type: "success" });
    } catch (error) {
      handleError(error, showErrorToast, { context: "Accept space invitation" });
    }
  };

  const handleDeclineInvitation = async (invitation: SpaceInvitation) => {
    try {
      await declineInvitation.mutateAsync({ name: invitation.name });
      toast.add({ title: t("setting.spaces.decline-success"), type: "success" });
    } catch (error) {
      handleError(error, showErrorToast, { context: "Decline space invitation" });
    }
  };

  if (managedSpaceName && !managedSpace && spacesQuery.isLoading) {
    return (
      <SettingSection title={t("setting.spaces.title")} description={t("setting.spaces.description")}>
        <SkeletonList label={t("setting.spaces.loading")} />
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
          <Button variant="primary" onClick={() => setCreateOpen(true)} icon={<PlusIcon />}>
            {t("setting.spaces.create-space")}
          </Button>
        }
        className="gap-5"
      >
        <div data-critical-surface="spaces-overview" className="flex min-w-0 flex-col gap-5">
          {receivedInvitations.length > 0 ? (
            <section aria-labelledby="space-invitations-heading" className="space-y-2.5">
              <div className="flex items-center justify-between">
                <h4 id="space-invitations-heading" className="mu-label">
                  {t("setting.spaces.invitations")}
                </h4>
                <span className="mu-caption text-mu-text-secondary">
                  {t("setting.spaces.pending-count", { count: receivedInvitations.length })}
                </span>
              </div>
              <List.Root aria-labelledby="space-invitations-heading">
                {receivedInvitations.map((invitation) => {
                  const uid = invitation.space ? extractSpaceUidFromName(invitation.space.name) : "";
                  const title = invitation.space?.title || t("setting.spaces.untitled");

                  return (
                    <List.Item key={invitation.name} className="flex flex-col gap-3 sm:flex-row sm:items-center">
                      <div className="flex min-w-0 flex-1 items-center gap-3">
                        <SpaceMark icon={invitation.space?.icon} size="lg" />
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="truncate mu-label">{title}</p>
                            <SpaceRoleBadge role={invitation.role} />
                          </div>
                          {uid ? (
                            <p className="mt-0.5 flex min-w-0 items-baseline gap-1 mu-caption text-mu-text-secondary">
                              <span className="shrink-0">{t("space.custom-id-label")}:</span>
                              <span title={uid} className="min-w-0 break-all font-mono">
                                {uid}
                              </span>
                            </p>
                          ) : null}
                          <p className="mt-1 truncate mu-caption text-mu-text-secondary">
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
                          variant="neutral"
                          size="sm"
                          aria-label={uid ? `${t("setting.spaces.accept")} ${title} (${uid})` : undefined}
                          disabled={acceptInvitation.isPending || declineInvitation.isPending}
                          onClick={() => void handleAcceptInvitation(invitation)}
                        >
                          {t("setting.spaces.accept")}
                        </Button>
                      </div>
                    </List.Item>
                  );
                })}
              </List.Root>
            </section>
          ) : null}

          <section aria-labelledby="your-spaces-heading" className="space-y-2.5">
            <div className="flex items-center justify-between">
              <h4 id="your-spaces-heading" className="mu-label">
                {t("setting.spaces.your-spaces")}
              </h4>
              {spaces.length > 0 ? (
                <span className="mu-caption text-mu-text-secondary">
                  {spaces.length === 1
                    ? t("setting.spaces.space-count", { count: spaces.length })
                    : t("setting.spaces.spaces-count", { count: spaces.length })}
                </span>
              ) : null}
            </div>
            {spacesQuery.isLoading ? (
              <SkeletonList label={t("setting.spaces.loading")} />
            ) : spacesQuery.isError ? (
              <ListMessage className="py-8">{t("setting.spaces.load-error")}</ListMessage>
            ) : spaces.length === 0 ? (
              <div className="rounded-mu-lg border border-dashed border-mu-line px-4 py-9 text-center">
                <p className="mu-label">{t("setting.spaces.no-spaces")}</p>
                <p className="mx-auto mt-1 max-w-md mu-caption text-mu-text-secondary">{t("setting.spaces.no-spaces-description")}</p>
                <Button variant="neutral" className="mt-4" onClick={() => setCreateOpen(true)} icon={<PlusIcon />}>
                  {t("setting.spaces.create-space")}
                </Button>
              </div>
            ) : (
              <List.Root aria-labelledby="your-spaces-heading">
                {spaces.map((space) => {
                  const uid = extractSpaceUidFromName(space.name);
                  const manageLabel = t("setting.spaces.manage-space", { space: space.title });

                  // The whole row opens the space.
                  return (
                    <List.Item key={space.name}>
                      <List.ItemButton
                        aria-label={uid ? `${manageLabel} (${uid})` : manageLabel}
                        onClick={() => handleOpenSpace(space.name)}
                        className="group"
                      >
                        <SpaceMark icon={space.icon} size="lg" />
                        <div className="min-w-0 flex-1">
                          <div className="flex min-w-0 flex-wrap items-center gap-2">
                            <p className="truncate mu-label">{space.title}</p>
                            <SpaceRoleBadge role={space.currentUserRole} />
                          </div>
                          <p className="mt-0.5 flex min-w-0 items-baseline gap-1 mu-caption text-mu-text-secondary">
                            <span className="shrink-0">{t("space.custom-id-label")}:</span>
                            <span title={uid} className="min-w-0 break-all font-mono">
                              {uid}
                            </span>
                          </p>
                          <p className="mt-1 truncate mu-caption text-mu-text-secondary">
                            {space.description || t("setting.spaces.no-description")}
                          </p>
                        </div>
                        <span className="hidden shrink-0 mu-caption text-mu-text-secondary sm:inline">
                          {space.memberCount === 1
                            ? t("setting.spaces.member-count", { count: space.memberCount })
                            : t("setting.spaces.members-count", { count: space.memberCount })}
                        </span>
                        <ChevronRightIcon className="mu-icon shrink-0 text-mu-text-secondary/65 transition-transform group-hover:translate-x-0.5" />
                      </List.ItemButton>
                    </List.Item>
                  );
                })}
              </List.Root>
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
  const [icon, setIcon] = useState(space.icon);
  const [inviteOpen, setInviteOpen] = useState(false);
  const inviteButtonRef = useRef<HTMLElement>(null);
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
  const iconChanged = !customIconsEqual(icon, space.icon);
  const detailsChanged = title.trim() !== space.title || description.trim() !== space.description || iconChanged;
  const spaceUid = extractSpaceUidFromName(space.name);
  const disambiguatedSpaceTitle = `${space.title} (${spaceUid})`;

  useEffect(() => {
    setTitle(space.title);
    setDescription(space.description);
    setIcon(space.icon);
  }, [space.description, space.title, space.icon]);

  const handleSave = async () => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle || !isAdmin || updateSpace.isPending) return;
    try {
      await updateSpace.mutateAsync({
        space: { name: space.name, title: trimmedTitle, description: description.trim(), ...(iconChanged ? { icon } : {}) },
        updateMask: ["title", "description", ...(iconChanged ? ["icon"] : [])],
      });
      toast.add({ title: t("setting.spaces.save-success"), type: "success" });
    } catch (error) {
      handleError(error, showErrorToast, { context: "Update space" });
    }
  };

  const handleRoleChange = async (member: SpaceMember, role: SpaceMember_Role) => {
    if (member.role === role || updateMember.isPending) return;
    try {
      await updateMember.mutateAsync({ spaceMember: { name: member.name, role }, updateMask: ["role"] });
      toast.add({ title: t("setting.spaces.role-update-success"), type: "success" });
    } catch (error) {
      handleError(error, showErrorToast, { context: "Update space member" });
    }
  };

  const handleRemoveMember = async () => {
    if (!removeTarget) return;
    try {
      await deleteMember.mutateAsync({ name: removeTarget.name });
      toast.add({ title: t("setting.spaces.remove-success", { username: extractUsernameFromName(removeTarget.user) }), type: "success" });
      setRemoveTarget(undefined);
    } catch (error) {
      handleError(error, showErrorToast, { context: "Remove space member" });
      throw error;
    }
  };

  const handleCancelInvitation = async () => {
    if (!cancelInvitationTarget) return;
    try {
      await deleteInvitation.mutateAsync({ name: cancelInvitationTarget.name });
      toast.add({ title: t("setting.spaces.cancel-invitation-success"), type: "success" });
      setCancelInvitationTarget(undefined);
    } catch (error) {
      handleError(error, showErrorToast, { context: "Cancel space invitation" });
      throw error;
    }
  };

  const handleLeave = async () => {
    if (!currentMember) return;
    try {
      await deleteMember.mutateAsync({ name: currentMember.name });
      toast.add({ title: t("setting.spaces.leave-success", { space: disambiguatedSpaceTitle }), type: "success" });
      onBack();
    } catch (error) {
      handleError(error, showErrorToast, { context: "Leave space" });
      throw error;
    }
  };

  const handleDeleteSpace = async () => {
    try {
      await deleteSpace.mutateAsync({ name: space.name });
      toast.add({ title: t("setting.spaces.delete-success", { space: disambiguatedSpaceTitle }), type: "success" });
      onBack();
    } catch (error) {
      handleError(error, showErrorToast, { context: "Delete space" });
      throw error;
    }
  };

  return (
    <section className="min-w-0">
      <button
        type="button"
        onClick={onBack}
        className="mb-4 inline-flex items-center gap-1.5 mu-body text-mu-text-secondary hover:text-mu-text"
      >
        <ArrowLeftIcon className="mu-icon" />
        {t("setting.spaces.label")}
      </button>

      <header className="flex min-w-0 flex-col gap-3 border-b border-mu-line/70 pb-4 sm:flex-row sm:items-center">
        <SpaceMark icon={space.icon} size="xl" />
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <h1 className="truncate mu-heading">{space.title}</h1>
            <SpaceRoleBadge role={currentRole} />
          </div>
          <p className="mt-1 flex min-w-0 items-baseline gap-1 mu-caption text-mu-text-secondary">
            <span className="shrink-0">{t("space.custom-id-label")}:</span>
            <span title={spaceUid} className="min-w-0 break-all font-mono">
              {spaceUid}
            </span>
          </p>
          <p className="mt-1 truncate mu-body text-mu-text-secondary">{space.description || t("setting.spaces.no-description")}</p>
        </div>
      </header>

      <Tabs.Root value={tab} onValueChange={(value) => setTab(value as DetailTab)} className="mt-2">
        <Tabs.List activateOnFocus aria-label={t("setting.spaces.title")}>
          <Tabs.Tab value="general">{t("setting.spaces.general")}</Tabs.Tab>
          <Tabs.Tab value="members">
            {t("setting.spaces.members")}
            <span className="text-mu-text-secondary">{members.length || space.memberCount}</span>
          </Tabs.Tab>
        </Tabs.List>
      </Tabs.Root>

      {tab === "general" ? (
        <div className="space-y-5 pt-3">
          <section aria-labelledby="space-details-heading" className="space-y-2.5">
            <div>
              <h4 id="space-details-heading" className="mu-label">
                {t("setting.spaces.space-details")}
              </h4>
              <p className="mt-1 mu-caption text-mu-text-secondary">{t("setting.spaces.space-details-description")}</p>
            </div>
            <List.Root aria-labelledby="space-details-heading">
              <List.Item className="grid gap-2 sm:grid-cols-[170px_1fr] sm:items-center">
                <span className="mu-label">{t("space.custom-id-label")}</span>
                <code className="min-w-0 break-all rounded-mu-md bg-mu-well/35 px-3 py-2 font-mono mu-caption text-mu-text/85">
                  {spaceUid}
                </code>
              </List.Item>
              <List.Item className="grid gap-2 sm:grid-cols-[170px_1fr] sm:items-center">
                <label htmlFor="space-settings-title" className="mu-label">
                  {t("common.name")}
                </label>
                <div className="flex items-center gap-2">
                  {isAdmin ? (
                    <SpaceIconPicker value={icon} onChange={setIcon} disabled={updateSpace.isPending} />
                  ) : (
                    <SpaceMark icon={icon} size="lg" className="size-8" />
                  )}
                  <Input id="space-settings-title" value={title} onChange={(event) => setTitle(event.target.value)} readOnly={!isAdmin} />
                </div>
              </List.Item>
              <List.Item>
                <Field.Root className="grid gap-2 sm:grid-cols-[170px_1fr] sm:items-start">
                  <div>
                    <Field.Label>{t("common.description")}</Field.Label>
                    <Field.Description className="mt-1">{t("setting.spaces.description-help")}</Field.Description>
                  </div>
                  <Textarea
                    id="space-settings-description"
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    readOnly={!isAdmin}
                    className="min-h-20 resize-none"
                  />
                </Field.Root>
              </List.Item>
            </List.Root>
            {isAdmin ? (
              <div className="flex justify-end">
                <Button
                  variant="primary"
                  disabled={!title.trim() || !detailsChanged || updateSpace.isPending}
                  onClick={() => void handleSave()}
                >
                  {t("setting.spaces.save-changes")}
                </Button>
              </div>
            ) : null}
          </section>

          <section aria-labelledby="space-access-heading" className="space-y-2.5">
            <h4 id="space-access-heading" className="mu-label">
              {t("setting.spaces.your-access")}
            </h4>
            <List.Root aria-labelledby="space-access-heading">
              <List.Item className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-2">
                  <ShieldCheckIcon className="mu-icon mt-0.5 shrink-0 text-mu-text-secondary" />
                  <div>
                    <p className="mu-label">{t("setting.spaces.role-in-space")}</p>
                    <p className="mt-1 mu-caption text-mu-text-secondary">
                      {isAdmin ? t("setting.spaces.admin-role-description") : t("setting.spaces.user-role-description")}
                    </p>
                  </div>
                </div>
                <SpaceRoleBadge role={currentRole} />
              </List.Item>
            </List.Root>
          </section>

          {/* Plain rows: red is kept for the confirm step, not the section that leads to it. */}
          <section className="flex flex-col gap-4 border-t border-mu-line/70 pt-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <h4 className="mu-label">{t("setting.spaces.leave-space")}</h4>
                <p className="mu-caption text-mu-text-secondary">
                  {isLastAdmin ? t("setting.spaces.last-admin-leave-description") : t("setting.spaces.leave-description")}
                </p>
              </div>
              <Button
                variant="neutral"
                className="shrink-0 self-start sm:self-auto"
                disabled={!currentMember || isLastAdmin}
                onClick={() => setLeaveOpen(true)}
              >
                {t("setting.spaces.leave-space")}
              </Button>
            </div>
            {isAdmin ? (
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <h4 className="mu-label">{t("setting.spaces.delete-space")}</h4>
                  <p className="mu-caption text-mu-text-secondary">{t("setting.spaces.delete-description")}</p>
                </div>
                <Button variant="neutral" className="shrink-0 self-start sm:self-auto" onClick={() => setDeleteOpen(true)}>
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
                <h4 id="space-members-heading" className="mu-label">
                  {t("setting.spaces.members")}
                </h4>
                <p className="mt-1 mu-caption text-mu-text-secondary">{t("setting.spaces.members-description")}</p>
              </div>
              {isAdmin ? (
                <Button ref={inviteButtonRef} variant="neutral" onClick={() => setInviteOpen(true)} icon={<UserPlusIcon />}>
                  {t("setting.spaces.invite-member")}
                </Button>
              ) : null}
            </div>

            {membersQuery.isLoading ? (
              <SkeletonList label={t("setting.spaces.loading-members")} />
            ) : membersQuery.isError ? (
              <ListMessage className="py-8">{t("setting.spaces.members-load-error")}</ListMessage>
            ) : (
              <List.Root aria-labelledby="space-members-heading">
                {members.map((member) => {
                  const isCurrentUser = member.user === viewerName;
                  return (
                    <List.Item key={member.name} className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                      <MemberIdentity
                        member={member}
                        user={usersByUsername.get(extractUsernameFromName(member.user))}
                        isCurrentUser={isCurrentUser}
                      />
                      <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
                        {isAdmin && !isCurrentUser ? (
                          <Select.Root
                            value={String(member.role)}
                            items={roleOptions}
                            disabled={updateMember.isPending}
                            onValueChange={(value) => void handleRoleChange(member, Number(value) as SpaceMember_Role)}
                            size="sm"
                          >
                            <Select.Trigger
                              className="w-[126px]"
                              aria-label={t("setting.spaces.change-role", { username: extractUsernameFromName(member.user) })}
                            >
                              <Select.Value />
                            </Select.Trigger>
                            <Select.Popup align="end">
                              <Select.Item value={String(SpaceMember_Role.USER)}>{t("setting.spaces.space-user")}</Select.Item>
                              <Select.Item value={String(SpaceMember_Role.ADMIN)}>{t("setting.spaces.space-admin")}</Select.Item>
                            </Select.Popup>
                          </Select.Root>
                        ) : (
                          <SpaceRoleBadge role={member.role} />
                        )}
                        {isAdmin && !isCurrentUser ? (
                          <Button variant="ghost" size="sm" onClick={() => setRemoveTarget(member)}>
                            {t("setting.spaces.remove")}
                          </Button>
                        ) : null}
                      </div>
                    </List.Item>
                  );
                })}
              </List.Root>
            )}
          </section>

          {isAdmin ? (
            <section className="space-y-2.5">
              <div className="flex items-center justify-between">
                <h4 id="space-pending-invitations-heading" className="mu-label">
                  {t("setting.spaces.pending-invitations")}
                </h4>
                <span className="mu-caption text-mu-text-secondary">{invitations.length}</span>
              </div>
              {invitationsQuery.isLoading ? (
                <SkeletonList label={t("setting.spaces.loading-invitations")} />
              ) : invitations.length === 0 ? (
                <ListMessage className="py-5">{t("setting.spaces.no-pending-invitations")}</ListMessage>
              ) : (
                <List.Root aria-labelledby="space-pending-invitations-heading">
                  {invitations.map((invitation) => (
                    <List.Item key={invitation.name} className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                      <InvitationIdentity invitation={invitation} user={usersByUsername.get(extractUsernameFromName(invitation.invitee))} />
                      <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
                        <Badge tone="warning" icon={<Clock3Icon />}>
                          {t("setting.spaces.invitation-pending")}
                        </Badge>
                        <SpaceRoleBadge role={invitation.role} />
                        <Button variant="ghost" size="sm" onClick={() => setCancelInvitationTarget(invitation)}>
                          {t("setting.spaces.cancel-invitation")}
                        </Button>
                      </div>
                    </List.Item>
                  ))}
                </List.Root>
              )}
            </section>
          ) : null}
        </div>
      )}

      <InviteSpaceMemberDialog
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        finalFocus={inviteButtonRef}
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
        confirmVariant="danger"
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
        confirmVariant="danger"
      />
      <ConfirmDialog
        open={Boolean(removeTarget)}
        onOpenChange={(open) => !open && setRemoveTarget(undefined)}
        title={t("setting.spaces.remove-confirm-title", { username: extractUsernameFromName(removeTarget?.user ?? "") })}
        description={t("setting.spaces.remove-confirm-description")}
        confirmLabel={t("setting.spaces.remove")}
        cancelLabel={t("common.cancel")}
        onConfirm={handleRemoveMember}
        confirmVariant="danger"
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
        confirmVariant="danger"
      />
    </section>
  );
};

export default SpacesSection;
