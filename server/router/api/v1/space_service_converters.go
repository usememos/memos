package v1

import (
	v1pb "github.com/usememos/memos/proto/gen/api/v1"
	storepb "github.com/usememos/memos/proto/gen/store"
	"github.com/usememos/memos/store"
)

func buildSpaceName(uid string) string {
	return SpaceNamePrefix + uid
}

func buildSpaceMemberName(spaceUID, username string) string {
	return buildSpaceName(spaceUID) + "/" + SpaceMemberNamePrefix + username
}

func buildSpaceInvitationName(spaceUID, username string) string {
	return buildSpaceName(spaceUID) + "/" + SpaceInvitationNamePrefix + username
}

func convertSpaceFromStore(space *store.Space) *v1pb.Space {
	converted := convertSpaceMetadataFromStore(space)
	if converted == nil {
		return nil
	}
	converted.CurrentUserRole = convertSpaceMemberRoleFromStore(space.CurrentUserRole)
	converted.MemberCount = space.MemberCount
	return converted
}

func convertSpaceMetadataFromStore(space *store.Space) *v1pb.Space {
	if space == nil {
		return nil
	}
	return &v1pb.Space{
		Name:        buildSpaceName(space.UID),
		Title:       space.Title,
		Description: space.Description,
		Icon:        convertSpaceIconFromStore(space.Payload.GetIcon()),
	}
}

func convertSpaceIconFromStore(icon *storepb.SpacePayload_Icon) *v1pb.Space_Icon {
	if icon == nil {
		return nil
	}
	switch value := icon.Value.(type) {
	case *storepb.SpacePayload_Icon_Emoji:
		return &v1pb.Space_Icon{Value: &v1pb.Space_Icon_Emoji{Emoji: value.Emoji}}
	case *storepb.SpacePayload_Icon_Lucide:
		return &v1pb.Space_Icon{Value: &v1pb.Space_Icon_Lucide{Lucide: value.Lucide}}
	default:
		return nil
	}
}

func convertSpaceIconToStore(icon *v1pb.Space_Icon) *storepb.SpacePayload_Icon {
	if icon == nil {
		return nil
	}
	switch value := icon.Value.(type) {
	case *v1pb.Space_Icon_Emoji:
		return &storepb.SpacePayload_Icon{Value: &storepb.SpacePayload_Icon_Emoji{Emoji: value.Emoji}}
	case *v1pb.Space_Icon_Lucide:
		return &storepb.SpacePayload_Icon{Value: &storepb.SpacePayload_Icon_Lucide{Lucide: value.Lucide}}
	default:
		// Preserve an empty icon so validation rejects it instead of treating it as a reset.
		return &storepb.SpacePayload_Icon{}
	}
}

func convertSpaceMemberRoleFromStore(role store.SpaceMemberRole) v1pb.SpaceMember_Role {
	switch role {
	case store.SpaceMemberRoleAdmin:
		return v1pb.SpaceMember_ADMIN
	case store.SpaceMemberRoleUser:
		return v1pb.SpaceMember_USER
	default:
		return v1pb.SpaceMember_ROLE_UNSPECIFIED
	}
}

func convertSpaceMemberRoleToStore(role v1pb.SpaceMember_Role) (store.SpaceMemberRole, bool) {
	switch role {
	case v1pb.SpaceMember_ADMIN:
		return store.SpaceMemberRoleAdmin, true
	case v1pb.SpaceMember_USER:
		return store.SpaceMemberRoleUser, true
	default:
		return "", false
	}
}

func convertSpaceMemberFromStore(space *store.Space, user *store.User, member *store.SpaceMember) *v1pb.SpaceMember {
	if space == nil || user == nil || member == nil {
		return nil
	}
	return &v1pb.SpaceMember{
		Name: buildSpaceMemberName(space.UID, user.Username),
		User: BuildUserName(user.Username),
		Role: convertSpaceMemberRoleFromStore(member.Role),
	}
}

func convertSpaceInvitationFromStore(space *store.Space, user *store.User, invitation *store.SpaceInvitation) *v1pb.SpaceInvitation {
	if space == nil || user == nil || invitation == nil {
		return nil
	}
	return &v1pb.SpaceInvitation{
		Name:    buildSpaceInvitationName(space.UID, user.Username),
		Invitee: BuildUserName(user.Username),
		Role:    convertSpaceMemberRoleFromStore(invitation.Role),
		Space:   convertSpaceMetadataFromStore(space),
	}
}
