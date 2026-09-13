package test

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/proto"
	"google.golang.org/protobuf/types/known/fieldmaskpb"

	v1pb "github.com/usememos/memos/proto/gen/api/v1"
)

func TestMemoViewIconLifecycle(t *testing.T) {
	ctx := context.Background()
	ts := NewTestService(t)
	defer ts.Cleanup()
	owner, err := ts.CreateRegularUser(ctx, "icon-owner")
	require.NoError(t, err)
	other, err := ts.CreateRegularUser(ctx, "icon-other")
	require.NoError(t, err)
	ownerCtx := ts.CreateUserContext(ctx, owner.ID)
	parent := "users/" + owner.Username
	emoji := &v1pb.MemoView_Icon{Value: &v1pb.MemoView_Icon_Emoji{Emoji: "👩🏽‍🌾"}}
	request := &v1pb.CreateMemoViewRequest{
		Parent:       parent,
		MemoView:     &v1pb.MemoView{Title: "Garden", Filter: "pinned", Icon: emoji},
		ValidateOnly: true,
	}
	validated, err := ts.Service.CreateMemoView(ownerCtx, request)
	require.NoError(t, err)
	require.True(t, proto.Equal(emoji, validated.Icon))
	listed, err := ts.Service.ListMemoViews(ownerCtx, &v1pb.ListMemoViewsRequest{Parent: parent})
	require.NoError(t, err)
	require.Empty(t, listed.MemoViews)

	request.ValidateOnly = false
	view, err := ts.Service.CreateMemoView(ownerCtx, request)
	require.NoError(t, err)
	require.True(t, proto.Equal(emoji, view.Icon))
	view, err = ts.Service.UpdateMemoView(ownerCtx, &v1pb.UpdateMemoViewRequest{
		MemoView:   &v1pb.MemoView{Name: view.Name, Title: "Renamed", Filter: "has_link"},
		UpdateMask: &fieldmaskpb.FieldMask{Paths: []string{"title", "filter"}},
	})
	require.NoError(t, err)
	require.True(t, proto.Equal(emoji, view.Icon), "other field updates preserve the icon")

	lucide := &v1pb.MemoView_Icon{Value: &v1pb.MemoView_Icon_Lucide{Lucide: "future-icon"}}
	update := &v1pb.UpdateMemoViewRequest{
		MemoView:   &v1pb.MemoView{Name: view.Name, Icon: lucide},
		UpdateMask: &fieldmaskpb.FieldMask{Paths: []string{"icon"}},
	}
	_, err = ts.Service.UpdateMemoView(ts.CreateUserContext(ctx, other.ID), update)
	require.Equal(t, codes.PermissionDenied, status.Code(err))
	view, err = ts.Service.UpdateMemoView(ownerCtx, update)
	require.NoError(t, err)
	require.True(t, proto.Equal(lucide, view.Icon))
	require.Equal(t, "Renamed", view.Title)
	require.Equal(t, "has_link", view.Filter)
	fetched, err := ts.Service.GetMemoView(ownerCtx, &v1pb.GetMemoViewRequest{Name: view.Name})
	require.NoError(t, err)
	require.True(t, proto.Equal(lucide, fetched.Icon))
	listed, err = ts.Service.ListMemoViews(ownerCtx, &v1pb.ListMemoViewsRequest{Parent: parent})
	require.NoError(t, err)
	require.Len(t, listed.MemoViews, 1)
	require.True(t, proto.Equal(lucide, listed.MemoViews[0].Icon))

	for _, invalid := range []*v1pb.MemoView_Icon{
		{},
		{Value: &v1pb.MemoView_Icon_Emoji{Emoji: "🌱🌱"}},
		{Value: &v1pb.MemoView_Icon_Emoji{Emoji: ""}},
		{Value: &v1pb.MemoView_Icon_Lucide{Lucide: "BookOpen"}},
		{Value: &v1pb.MemoView_Icon_Lucide{Lucide: ""}},
	} {
		request.MemoView.Icon = invalid
		request.ValidateOnly = true
		_, err = ts.Service.CreateMemoView(ownerCtx, request)
		require.Equal(t, codes.InvalidArgument, status.Code(err))
		request.ValidateOnly = false
		_, err = ts.Service.CreateMemoView(ownerCtx, request)
		require.Equal(t, codes.InvalidArgument, status.Code(err))
		update.MemoView.Icon = invalid
		_, err = ts.Service.UpdateMemoView(ownerCtx, update)
		require.Equal(t, codes.InvalidArgument, status.Code(err))
	}
	fetched, err = ts.Service.GetMemoView(ownerCtx, &v1pb.GetMemoViewRequest{Name: view.Name})
	require.NoError(t, err)
	require.True(t, proto.Equal(lucide, fetched.Icon), "invalid updates leave storage unchanged")

	update.MemoView.Icon = nil
	view, err = ts.Service.UpdateMemoView(ownerCtx, update)
	require.NoError(t, err)
	require.Nil(t, view.Icon)
	fetched, err = ts.Service.GetMemoView(ownerCtx, &v1pb.GetMemoViewRequest{Name: view.Name})
	require.NoError(t, err)
	require.Nil(t, fetched.Icon)
}
