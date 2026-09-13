package v1

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/proto"
	"google.golang.org/protobuf/types/known/fieldmaskpb"

	v1pb "github.com/usememos/memos/proto/gen/api/v1"
	"github.com/usememos/memos/store"
)

func TestSpaceIconLifecycle(t *testing.T) {
	ctx := context.Background()
	service := newIntegrationService(t)
	owner := createSpaceTestUser(ctx, t, service, "icon-owner", store.RoleUser)
	member := createSpaceTestUser(ctx, t, service, "icon-member", store.RoleUser)
	ownerCtx := userCtx(ctx, owner.ID)
	emoji := &v1pb.Space_Icon{Value: &v1pb.Space_Icon_Emoji{Emoji: "🌱"}}
	space, err := service.CreateSpace(ownerCtx, &v1pb.CreateSpaceRequest{
		SpaceId: "icon-space", Space: &v1pb.Space{Title: "Garden", Icon: emoji},
	})
	require.NoError(t, err)
	require.True(t, proto.Equal(emoji, space.Icon))

	invitation := inviteSpaceTestUser(ctx, t, service, owner, member, space, v1pb.SpaceMember_USER)
	require.True(t, proto.Equal(emoji, invitation.Space.Icon), "invitation metadata includes the icon")
	_, err = service.AcceptSpaceInvitation(userCtx(ctx, member.ID), &v1pb.AcceptSpaceInvitationRequest{Name: invitation.Name})
	require.NoError(t, err)

	space, err = service.UpdateSpace(ownerCtx, &v1pb.UpdateSpaceRequest{
		Space: &v1pb.Space{Name: space.Name, Title: "Renamed"}, UpdateMask: &fieldmaskpb.FieldMask{Paths: []string{"title"}},
	})
	require.NoError(t, err)
	require.True(t, proto.Equal(emoji, space.Icon), "unmasked icon remains unchanged")
	lucide := &v1pb.Space_Icon{Value: &v1pb.Space_Icon_Lucide{Lucide: "leaf"}}
	update := &v1pb.UpdateSpaceRequest{
		Space: &v1pb.Space{Name: space.Name, Icon: lucide}, UpdateMask: &fieldmaskpb.FieldMask{Paths: []string{"icon"}},
	}
	_, err = service.UpdateSpace(userCtx(ctx, member.ID), update)
	require.Equal(t, codes.PermissionDenied, status.Code(err))
	space, err = service.UpdateSpace(ownerCtx, update)
	require.NoError(t, err)
	require.True(t, proto.Equal(lucide, space.Icon))
	require.Equal(t, "Renamed", space.Title)
	fetched, err := service.GetSpace(ownerCtx, &v1pb.GetSpaceRequest{Name: space.Name})
	require.NoError(t, err)
	require.True(t, proto.Equal(lucide, fetched.Icon))
	listed, err := service.ListSpaces(ownerCtx, &v1pb.ListSpacesRequest{})
	require.NoError(t, err)
	require.Len(t, listed.Spaces, 1)
	require.True(t, proto.Equal(lucide, listed.Spaces[0].Icon))

	update.Space.Icon = &v1pb.Space_Icon{Value: &v1pb.Space_Icon_Emoji{Emoji: "not an emoji"}}
	_, err = service.UpdateSpace(ownerCtx, update)
	require.Equal(t, codes.InvalidArgument, status.Code(err))
	fetched, err = service.GetSpace(ownerCtx, &v1pb.GetSpaceRequest{Name: space.Name})
	require.NoError(t, err)
	require.True(t, proto.Equal(lucide, fetched.Icon), "invalid updates do not change the stored icon")

	update.Space.Icon = nil
	space, err = service.UpdateSpace(ownerCtx, update)
	require.NoError(t, err)
	require.Nil(t, space.Icon)
	fetched, err = service.GetSpace(ownerCtx, &v1pb.GetSpaceRequest{Name: space.Name})
	require.NoError(t, err)
	require.Nil(t, fetched.Icon)
}

func TestCreateSpaceRejectsInvalidIcon(t *testing.T) {
	ctx := context.Background()
	service := newIntegrationService(t)
	owner := createSpaceTestUser(ctx, t, service, "invalid-icon-owner", store.RoleUser)
	for _, icon := range []*v1pb.Space_Icon{
		{},
		{Value: &v1pb.Space_Icon_Emoji{Emoji: "🌱🌱"}},
		{Value: &v1pb.Space_Icon_Lucide{Lucide: "<svg>"}},
	} {
		_, err := service.CreateSpace(userCtx(ctx, owner.ID), &v1pb.CreateSpaceRequest{Space: &v1pb.Space{Title: "Invalid", Icon: icon}})
		require.Equal(t, codes.InvalidArgument, status.Code(err))
	}
	spaces, err := service.ListSpaces(userCtx(ctx, owner.ID), &v1pb.ListSpacesRequest{})
	require.NoError(t, err)
	require.Empty(t, spaces.Spaces)
}
