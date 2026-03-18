package test

import (
	"context"
	"fmt"
	"testing"

	"github.com/stretchr/testify/require"
	colorpb "google.golang.org/genproto/googleapis/type/color"
	"google.golang.org/protobuf/types/known/fieldmaskpb"

	apiv1 "github.com/usememos/memos/proto/gen/api/v1"
)

func TestUserSettingTags(t *testing.T) {
	t.Parallel()
	ctx := context.Background()

	t.Run("GetUserSetting returns empty tags setting by default", func(t *testing.T) {
		ts := NewTestService(t)
		defer ts.Cleanup()

		user, err := ts.CreateHostUser(ctx, "tags-default")
		require.NoError(t, err)

		response, err := ts.Service.GetUserSetting(ts.CreateUserContext(ctx, user.ID), &apiv1.GetUserSettingRequest{
			Name: fmt.Sprintf("users/%d/settings/TAGS", user.ID),
		})
		require.NoError(t, err)
		require.NotNil(t, response)
		require.NotNil(t, response.GetTagsSetting())
		require.Empty(t, response.GetTagsSetting().GetTags())
	})

	t.Run("UpdateUserSetting replaces tag metadata", func(t *testing.T) {
		ts := NewTestService(t)
		defer ts.Cleanup()

		user, err := ts.CreateHostUser(ctx, "tags-update")
		require.NoError(t, err)
		userCtx := ts.CreateUserContext(ctx, user.ID)

		settingName := fmt.Sprintf("users/%d/settings/TAGS", user.ID)
		updateRequest := &apiv1.UpdateUserSettingRequest{
			Setting: &apiv1.UserSetting{
				Name: settingName,
				Value: &apiv1.UserSetting_TagsSetting_{
					TagsSetting: &apiv1.UserSetting_TagsSetting{
						Tags: map[string]*apiv1.UserSetting_TagMetadata{
							"bug": {
								BackgroundColor: &colorpb.Color{
									Red:   0.9,
									Green: 0.1,
									Blue:  0.1,
								},
							},
						},
					},
				},
			},
			UpdateMask: &fieldmaskpb.FieldMask{Paths: []string{"tags"}},
		}

		response, err := ts.Service.UpdateUserSetting(userCtx, updateRequest)
		require.NoError(t, err)
		require.NotNil(t, response.GetTagsSetting())
		require.Contains(t, response.GetTagsSetting().GetTags(), "bug")
		require.InDelta(t, 0.9, response.GetTagsSetting().GetTags()["bug"].GetBackgroundColor().GetRed(), 0.0001)

		getResponse, err := ts.Service.GetUserSetting(userCtx, &apiv1.GetUserSettingRequest{Name: settingName})
		require.NoError(t, err)
		require.Len(t, getResponse.GetTagsSetting().GetTags(), 1)
		require.Contains(t, getResponse.GetTagsSetting().GetTags(), "bug")
	})

	t.Run("UpdateUserSetting rejects invalid color", func(t *testing.T) {
		ts := NewTestService(t)
		defer ts.Cleanup()

		user, err := ts.CreateHostUser(ctx, "tags-invalid")
		require.NoError(t, err)

		_, err = ts.Service.UpdateUserSetting(ts.CreateUserContext(ctx, user.ID), &apiv1.UpdateUserSettingRequest{
			Setting: &apiv1.UserSetting{
				Name: fmt.Sprintf("users/%d/settings/TAGS", user.ID),
				Value: &apiv1.UserSetting_TagsSetting_{
					TagsSetting: &apiv1.UserSetting_TagsSetting{
						Tags: map[string]*apiv1.UserSetting_TagMetadata{
							"bug": {
								BackgroundColor: &colorpb.Color{
									Red:   1.2,
									Green: 0.1,
									Blue:  0.1,
								},
							},
						},
					},
				},
			},
			UpdateMask: &fieldmaskpb.FieldMask{Paths: []string{"tags"}},
		})
		require.Error(t, err)
		require.Contains(t, err.Error(), "invalid tags setting")
	})

	t.Run("Other users cannot read or update tag metadata", func(t *testing.T) {
		ts := NewTestService(t)
		defer ts.Cleanup()

		user, err := ts.CreateHostUser(ctx, "tags-owner")
		require.NoError(t, err)
		otherUser, err := ts.CreateHostUser(ctx, "tags-other")
		require.NoError(t, err)

		settingName := fmt.Sprintf("users/%d/settings/TAGS", user.ID)
		_, err = ts.Service.GetUserSetting(ts.CreateUserContext(ctx, otherUser.ID), &apiv1.GetUserSettingRequest{
			Name: settingName,
		})
		require.Error(t, err)
		require.Contains(t, err.Error(), "permission denied")

		_, err = ts.Service.UpdateUserSetting(ts.CreateUserContext(ctx, otherUser.ID), &apiv1.UpdateUserSettingRequest{
			Setting: &apiv1.UserSetting{
				Name: settingName,
				Value: &apiv1.UserSetting_TagsSetting_{
					TagsSetting: &apiv1.UserSetting_TagsSetting{
						Tags: map[string]*apiv1.UserSetting_TagMetadata{
							"bug": {
								BackgroundColor: &colorpb.Color{
									Red:   0.1,
									Green: 0.2,
									Blue:  0.3,
								},
							},
						},
					},
				},
			},
			UpdateMask: &fieldmaskpb.FieldMask{Paths: []string{"tags"}},
		})
		require.Error(t, err)
		require.Contains(t, err.Error(), "permission denied")
	})
}
