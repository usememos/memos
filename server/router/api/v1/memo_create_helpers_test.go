package v1

import (
	"context"
	"fmt"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/timestamppb"

	v1pb "github.com/usememos/memos/proto/gen/api/v1"
	"github.com/usememos/memos/store"
)

func TestMemoCreateSharedPreparationPreservesFields(t *testing.T) {
	ctx := context.Background()
	service := newIntegrationService(t)
	user := createSpaceTestUser(ctx, t, service, "memo-create-fields", store.RoleUser)
	userCtx := userCtx(ctx, user.ID)

	referenceTarget, err := service.CreateMemo(userCtx, &v1pb.CreateMemoRequest{
		MemoId: "create-fields-reference",
		Memo:   &v1pb.Memo{Content: "reference target", Visibility: v1pb.Visibility_PRIVATE},
	})
	require.NoError(t, err)

	createAttachment := func(id string) *v1pb.Attachment {
		t.Helper()
		attachment, err := service.CreateAttachment(userCtx, &v1pb.CreateAttachmentRequest{
			AttachmentId: id,
			Attachment: &v1pb.Attachment{
				Filename: id + ".png",
				Type:     "image/png",
				Content:  []byte("test image"),
			},
		})
		require.NoError(t, err)
		return attachment
	}
	createReference := func() *v1pb.MemoRelation {
		return &v1pb.MemoRelation{
			RelatedMemo: &v1pb.MemoRelation_Memo{Name: referenceTarget.Name},
			Type:        v1pb.MemoRelation_REFERENCE,
		}
	}

	topAttachment := createAttachment("create-fields-top-image")
	topAttachmentUID := strings.TrimPrefix(topAttachment.Name, "attachments/")
	topCreateTime := time.Date(2022, time.March, 4, 5, 6, 7, 0, time.UTC)
	topUpdateTime := topCreateTime.Add(2 * time.Hour)
	topLocation := &v1pb.Location{Placeholder: "top location", Latitude: 1.25, Longitude: 2.5}
	topMemo, err := service.CreateMemo(userCtx, &v1pb.CreateMemoRequest{
		MemoId: "create-fields-top",
		Memo: &v1pb.Memo{
			Content:     fmt.Sprintf("![top](/file/attachments/%s)", topAttachmentUID),
			Visibility:  v1pb.Visibility_PRIVATE,
			CreateTime:  timestamppb.New(topCreateTime),
			UpdateTime:  timestamppb.New(topUpdateTime),
			Attachments: []*v1pb.Attachment{{Name: topAttachment.Name}},
			Relations:   []*v1pb.MemoRelation{createReference()},
			Location:    topLocation,
		},
	})
	require.NoError(t, err)
	require.Equal(t, topCreateTime.Unix(), topMemo.CreateTime.AsTime().Unix())
	require.Equal(t, topUpdateTime.Unix(), topMemo.UpdateTime.AsTime().Unix())
	require.Equal(t, topLocation.Placeholder, topMemo.Location.Placeholder)
	require.Equal(t, topLocation.Latitude, topMemo.Location.Latitude)
	require.Equal(t, topLocation.Longitude, topMemo.Location.Longitude)
	require.Len(t, topMemo.Attachments, 1)
	require.Equal(t, topAttachment.Name, topMemo.Attachments[0].Name)
	requireMemoCreateRelation(t, topMemo, v1pb.MemoRelation_REFERENCE, referenceTarget.Name)

	commentAttachment := createAttachment("create-fields-comment-image")
	commentAttachmentUID := strings.TrimPrefix(commentAttachment.Name, "attachments/")
	commentCreateTime := time.Date(2023, time.April, 5, 6, 7, 8, 0, time.UTC)
	commentUpdateTime := commentCreateTime.Add(3 * time.Hour)
	commentLocation := &v1pb.Location{Placeholder: "comment location", Latitude: 3.75, Longitude: 4.5}
	comment, err := service.CreateMemoComment(userCtx, &v1pb.CreateMemoCommentRequest{
		Name:      topMemo.Name,
		CommentId: "create-fields-comment",
		Comment: &v1pb.Memo{
			Content:     fmt.Sprintf("![comment](/file/attachments/%s)", commentAttachmentUID),
			Visibility:  v1pb.Visibility_PROTECTED,
			CreateTime:  timestamppb.New(commentCreateTime),
			UpdateTime:  timestamppb.New(commentUpdateTime),
			Attachments: []*v1pb.Attachment{{Name: commentAttachment.Name}},
			Relations:   []*v1pb.MemoRelation{createReference()},
			Location:    commentLocation,
		},
	})
	require.NoError(t, err)
	require.Equal(t, commentCreateTime.Unix(), comment.CreateTime.AsTime().Unix())
	require.Equal(t, commentUpdateTime.Unix(), comment.UpdateTime.AsTime().Unix())
	require.Equal(t, commentLocation.Placeholder, comment.Location.Placeholder)
	require.Equal(t, commentLocation.Latitude, comment.Location.Latitude)
	require.Equal(t, commentLocation.Longitude, comment.Location.Longitude)
	require.Equal(t, v1pb.Visibility_PROTECTED, comment.Visibility)
	require.Len(t, comment.Attachments, 1)
	require.Equal(t, commentAttachment.Name, comment.Attachments[0].Name)
	requireMemoCreateRelation(t, comment, v1pb.MemoRelation_COMMENT, topMemo.Name)
	requireMemoCreateRelation(t, comment, v1pb.MemoRelation_REFERENCE, referenceTarget.Name)
}

func TestMemoCreateDuplicateIDsUseAlreadyExists(t *testing.T) {
	ctx := context.Background()
	service := newIntegrationService(t)
	user := createSpaceTestUser(ctx, t, service, "memo-create-duplicates", store.RoleUser)
	userCtx := userCtx(ctx, user.ID)

	parent, err := service.CreateMemo(userCtx, &v1pb.CreateMemoRequest{
		MemoId: "duplicate-parent",
		Memo:   &v1pb.Memo{Content: "parent", Visibility: v1pb.Visibility_PRIVATE},
	})
	require.NoError(t, err)
	_, err = service.CreateMemo(userCtx, &v1pb.CreateMemoRequest{
		MemoId: "duplicate-parent",
		Memo:   &v1pb.Memo{Content: "duplicate", Visibility: v1pb.Visibility_PRIVATE},
	})
	require.Equal(t, codes.AlreadyExists, status.Code(err))

	createComment := func() error {
		_, err := service.CreateMemoComment(userCtx, &v1pb.CreateMemoCommentRequest{
			Name:      parent.Name,
			CommentId: "duplicate-comment",
			Comment:   &v1pb.Memo{Content: "comment", Visibility: v1pb.Visibility_PRIVATE},
		})
		return err
	}
	require.NoError(t, createComment())
	require.Equal(t, codes.AlreadyExists, status.Code(createComment()))
}

func requireMemoCreateRelation(t *testing.T, memo *v1pb.Memo, relationType v1pb.MemoRelation_Type, relatedMemoName string) {
	t.Helper()
	for _, relation := range memo.Relations {
		if relation.Type == relationType && relation.GetRelatedMemo().GetName() == relatedMemoName {
			require.Equal(t, memo.Name, relation.GetMemo().GetName())
			return
		}
	}
	require.Failf(t, "memo relation not found", "missing %s relation from %s to %s", relationType, memo.Name, relatedMemoName)
}
