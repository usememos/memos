package api

import (
	apipb "github.com/usememos/memos/proto/gen/api"
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

func convertSpaceFromStore(space *store.Space) *apipb.Space {
	converted := convertSpaceMetadataFromStore(space)
	if converted == nil {
		return nil
	}
	converted.CurrentUserRole = convertSpaceMemberRoleFromStore(space.CurrentUserRole)
	converted.MemberCount = space.MemberCount
	return converted
}

func convertSpaceMetadataFromStore(space *store.Space) *apipb.Space {
	if space == nil {
		return nil
	}
	return &apipb.Space{
		Name:        buildSpaceName(space.UID),
		Title:       space.Title,
		Description: space.Description,
		Icon:        convertSpaceIconFromStore(space.Payload.GetIcon()),
	}
}

func convertSpaceIconFromStore(icon *storepb.SpacePayload_Icon) *apipb.Space_Icon {
	if icon == nil {
		return nil
	}
	switch value := icon.Value.(type) {
	case *storepb.SpacePayload_Icon_Emoji:
		return &apipb.Space_Icon{Value: &apipb.Space_Icon_Emoji{Emoji: value.Emoji}}
	case *storepb.SpacePayload_Icon_Lucide:
		return &apipb.Space_Icon{Value: &apipb.Space_Icon_Lucide{Lucide: value.Lucide}}
	default:
		return nil
	}
}

func convertSpaceIconToStore(icon *apipb.Space_Icon) *storepb.SpacePayload_Icon {
	if icon == nil {
		return nil
	}
	switch value := icon.Value.(type) {
	case *apipb.Space_Icon_Emoji:
		return &storepb.SpacePayload_Icon{Value: &storepb.SpacePayload_Icon_Emoji{Emoji: value.Emoji}}
	case *apipb.Space_Icon_Lucide:
		return &storepb.SpacePayload_Icon{Value: &storepb.SpacePayload_Icon_Lucide{Lucide: value.Lucide}}
	default:
		// Preserve an empty icon so validation rejects it instead of treating it as a reset.
		return &storepb.SpacePayload_Icon{}
	}
}

func convertSpaceMemberRoleFromStore(role store.SpaceMemberRole) apipb.SpaceMember_Role {
	switch role {
	case store.SpaceMemberRoleAdmin:
		return apipb.SpaceMember_ADMIN
	case store.SpaceMemberRoleUser:
		return apipb.SpaceMember_USER
	default:
		return apipb.SpaceMember_ROLE_UNSPECIFIED
	}
}

func convertSpaceMemberRoleToStore(role apipb.SpaceMember_Role) (store.SpaceMemberRole, bool) {
	switch role {
	case apipb.SpaceMember_ADMIN:
		return store.SpaceMemberRoleAdmin, true
	case apipb.SpaceMember_USER:
		return store.SpaceMemberRoleUser, true
	default:
		return "", false
	}
}

func convertSpaceMemberFromStore(space *store.Space, user *store.User, member *store.SpaceMember) *apipb.SpaceMember {
	if space == nil || user == nil || member == nil {
		return nil
	}
	return &apipb.SpaceMember{
		Name: buildSpaceMemberName(space.UID, user.Username),
		User: BuildUserName(user.Username),
		Role: convertSpaceMemberRoleFromStore(member.Role),
	}
}

func convertSpaceInvitationFromStore(space *store.Space, user *store.User, invitation *store.SpaceInvitation) *apipb.SpaceInvitation {
	if space == nil || user == nil || invitation == nil {
		return nil
	}
	return &apipb.SpaceInvitation{
		Name:    buildSpaceInvitationName(space.UID, user.Username),
		Invitee: BuildUserName(user.Username),
		Role:    convertSpaceMemberRoleFromStore(invitation.Role),
		Space:   convertSpaceMetadataFromStore(space),
	}
}
