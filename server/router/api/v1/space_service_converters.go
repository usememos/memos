package v1

import (
	v1pb "github.com/usememos/memos/proto/gen/api/v1"
	"github.com/usememos/memos/store"
)

func buildSpaceName(uid string) string {
	return SpaceNamePrefix + uid
}

func buildSpaceMemberName(spaceUID, username string) string {
	return buildSpaceName(spaceUID) + "/" + SpaceMemberNamePrefix + username
}

func convertSpaceFromStore(space *store.Space) *v1pb.Space {
	if space == nil {
		return nil
	}
	return &v1pb.Space{
		Name:        buildSpaceName(space.UID),
		Title:       space.Title,
		Description: space.Description,
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
