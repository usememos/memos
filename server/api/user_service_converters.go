package api

import (
	"fmt"
	"regexp"
	"time"

	"github.com/pkg/errors"
	"google.golang.org/protobuf/types/known/timestamppb"

	apipb "github.com/usememos/memos/proto/gen/api"
	storepb "github.com/usememos/memos/proto/gen/store"
	"github.com/usememos/memos/store"
)

func convertUserFromStore(user *store.User, viewer *store.User) *apipb.User {
	userpb := &apipb.User{
		Name:        BuildUserName(user.Username),
		State:       convertStateFromStore(user.RowStatus),
		CreateTime:  timestamppb.New(time.Unix(user.CreatedTs, 0)),
		UpdateTime:  timestamppb.New(time.Unix(user.UpdatedTs, 0)),
		Role:        convertUserRoleFromStore(user.Role),
		Username:    user.Username,
		DisplayName: user.Nickname,
		AvatarUrl:   user.AvatarURL,
		Description: user.Description,
	}
	if canViewerAccessUserEmail(viewer, user) {
		userpb.Email = user.Email
	}
	// Use the avatar URL instead of raw base64 image data to reduce the response size.
	if user.AvatarURL != "" {
		// Check if avatar url is base64 format.
		_, _, err := extractImageInfo(user.AvatarURL)
		if err == nil {
			userpb.AvatarUrl = fmt.Sprintf("/file/%s/avatar", userpb.Name)
		} else {
			userpb.AvatarUrl = user.AvatarURL
		}
	}
	return userpb
}

func canViewerAccessUserEmail(viewer, user *store.User) bool {
	if viewer == nil || user == nil {
		return false
	}
	return viewer.Role == store.RoleAdmin || viewer.ID == user.ID
}

func convertUserRoleFromStore(role store.Role) apipb.User_Role {
	switch role {
	case store.RoleAdmin:
		return apipb.User_ADMIN
	case store.RoleUser:
		return apipb.User_USER
	default:
		return apipb.User_ROLE_UNSPECIFIED
	}
}

func convertUserRoleToStore(role apipb.User_Role) store.Role {
	switch role {
	case apipb.User_ADMIN:
		return store.RoleAdmin
	default:
		return store.RoleUser
	}
}

// extractImageInfo extracts image type and base64 data from a data URI.
// Data URI format: data:image/png;base64,iVBORw0KGgo...
func extractImageInfo(dataURI string) (string, string, error) {
	dataURIRegex := regexp.MustCompile(`^data:(?P<type>.+);base64,(?P<base64>.+)`)
	matches := dataURIRegex.FindStringSubmatch(dataURI)
	if len(matches) != 3 {
		return "", "", errors.New("invalid data URI format")
	}
	imageType := matches[1]
	base64Data := matches[2]
	return imageType, base64Data, nil
}

// convertSettingKeyToStore converts API setting key to store enum.
func convertSettingKeyToStore(key string) (storepb.UserSetting_Key, error) {
	switch key {
	case apipb.UserSetting_Key_name[int32(apipb.UserSetting_GENERAL)]:
		return storepb.UserSetting_GENERAL, nil
	case apipb.UserSetting_Key_name[int32(apipb.UserSetting_WEBHOOKS)]:
		return storepb.UserSetting_WEBHOOKS, nil
	case apipb.UserSetting_Key_name[int32(apipb.UserSetting_TAGS)]:
		return storepb.UserSetting_TAGS, nil
	default:
		return storepb.UserSetting_KEY_UNSPECIFIED, errors.Errorf("unknown setting key: %s", key)
	}
}

// convertSettingKeyFromStore converts store enum to API setting key.
func convertSettingKeyFromStore(key storepb.UserSetting_Key) string {
	switch key {
	case storepb.UserSetting_GENERAL:
		return apipb.UserSetting_Key_name[int32(apipb.UserSetting_GENERAL)]
	case storepb.UserSetting_MEMO_VIEWS:
		return "MEMO_VIEWS" // Not defined in API proto
	case storepb.UserSetting_WEBHOOKS:
		return apipb.UserSetting_Key_name[int32(apipb.UserSetting_WEBHOOKS)]
	case storepb.UserSetting_TAGS:
		return apipb.UserSetting_Key_name[int32(apipb.UserSetting_TAGS)]
	default:
		return "unknown"
	}
}

func convertUserTagsSettingFromStore(setting *storepb.TagsUserSetting) *apipb.UserSetting_TagsSetting {
	if setting == nil {
		return &apipb.UserSetting_TagsSetting{Tags: map[string]*apipb.UserSetting_TagMetadata{}}
	}
	tags := make(map[string]*apipb.UserSetting_TagMetadata, len(setting.Tags))
	for tag, metadata := range setting.Tags {
		if metadata == nil {
			tags[tag] = &apipb.UserSetting_TagMetadata{}
			continue
		}
		tags[tag] = &apipb.UserSetting_TagMetadata{
			BackgroundColor: metadata.GetBackgroundColor(),
			BlurContent:     metadata.GetBlurContent(),
		}
	}
	return &apipb.UserSetting_TagsSetting{Tags: tags}
}

func convertUserTagsSettingToStore(setting *apipb.UserSetting_TagsSetting) *storepb.TagsUserSetting {
	if setting == nil {
		return &storepb.TagsUserSetting{Tags: map[string]*storepb.UserTagMetadata{}}
	}
	tags := make(map[string]*storepb.UserTagMetadata, len(setting.Tags))
	for tag, metadata := range setting.Tags {
		if metadata == nil {
			tags[tag] = &storepb.UserTagMetadata{}
			continue
		}
		tags[tag] = &storepb.UserTagMetadata{
			BackgroundColor: metadata.GetBackgroundColor(),
			BlurContent:     metadata.GetBlurContent(),
		}
	}
	return &storepb.TagsUserSetting{Tags: tags}
}

// convertUserSettingFromStore converts store UserSetting to API UserSetting.
func convertUserSettingFromStore(storeSetting *storepb.UserSetting, user *store.User, key storepb.UserSetting_Key) *apipb.UserSetting {
	if storeSetting == nil {
		// Return default setting if none exists
		settingKey := convertSettingKeyFromStore(key)
		setting := &apipb.UserSetting{
			Name: fmt.Sprintf("%s/settings/%s", BuildUserName(user.Username), settingKey),
		}

		switch key {
		case storepb.UserSetting_GENERAL:
			setting.Value = &apipb.UserSetting_GeneralSetting_{
				GeneralSetting: getDefaultUserGeneralSetting(),
			}
		case storepb.UserSetting_WEBHOOKS:
			setting.Value = &apipb.UserSetting_WebhooksSetting_{
				WebhooksSetting: &apipb.UserSetting_WebhooksSetting{
					Webhooks: []*apipb.UserWebhook{},
				},
			}
		case storepb.UserSetting_TAGS:
			setting.Value = &apipb.UserSetting_TagsSetting_{
				TagsSetting: &apipb.UserSetting_TagsSetting{Tags: map[string]*apipb.UserSetting_TagMetadata{}},
			}
		default:
			return nil
		}
		return setting
	}

	settingKey := convertSettingKeyFromStore(storeSetting.Key)
	setting := &apipb.UserSetting{
		Name: fmt.Sprintf("%s/settings/%s", BuildUserName(user.Username), settingKey),
	}

	switch storeSetting.Key {
	case storepb.UserSetting_GENERAL:
		if general := storeSetting.GetGeneral(); general != nil {
			setting.Value = &apipb.UserSetting_GeneralSetting_{
				GeneralSetting: &apipb.UserSetting_GeneralSetting{
					Locale:            general.Locale,
					MemoVisibility:    general.MemoVisibility,
					Theme:             general.Theme,
					SaveMediaMetadata: general.SaveMediaMetadata,
				},
			}
		} else {
			setting.Value = &apipb.UserSetting_GeneralSetting_{
				GeneralSetting: getDefaultUserGeneralSetting(),
			}
		}
	case storepb.UserSetting_WEBHOOKS:
		webhooks := storeSetting.GetWebhooks()
		apiWebhooks := make([]*apipb.UserWebhook, 0)
		if webhooks != nil {
			apiWebhooks = make([]*apipb.UserWebhook, 0, len(webhooks.Webhooks))
			for _, webhook := range webhooks.Webhooks {
				apiWebhook := &apipb.UserWebhook{
					Name:             fmt.Sprintf("%s/webhooks/%s", BuildUserName(user.Username), webhook.Id),
					Url:              webhook.Url,
					DisplayName:      webhook.Title,
					SigningSecretSet: webhook.SigningSecret != "",
				}
				apiWebhooks = append(apiWebhooks, apiWebhook)
			}
		}
		setting.Value = &apipb.UserSetting_WebhooksSetting_{
			WebhooksSetting: &apipb.UserSetting_WebhooksSetting{
				Webhooks: apiWebhooks,
			},
		}
	case storepb.UserSetting_TAGS:
		setting.Value = &apipb.UserSetting_TagsSetting_{
			TagsSetting: convertUserTagsSettingFromStore(storeSetting.GetTags()),
		}
	default:
		return nil
	}

	return setting
}

// convertUserSettingToStore converts API UserSetting to store UserSetting.
func convertUserSettingToStore(apiSetting *apipb.UserSetting, userID int32, key storepb.UserSetting_Key) (*storepb.UserSetting, error) {
	storeSetting := &storepb.UserSetting{
		UserId: userID,
		Key:    key,
	}

	switch key {
	case storepb.UserSetting_GENERAL:
		if general := apiSetting.GetGeneralSetting(); general != nil {
			storeSetting.Value = &storepb.UserSetting_General{
				General: &storepb.GeneralUserSetting{
					Locale:            general.Locale,
					MemoVisibility:    general.MemoVisibility,
					Theme:             general.Theme,
					SaveMediaMetadata: general.SaveMediaMetadata,
				},
			}
		} else {
			return nil, errors.Errorf("general setting is required")
		}
	case storepb.UserSetting_WEBHOOKS:
		if webhooks := apiSetting.GetWebhooksSetting(); webhooks != nil {
			storeWebhooks := make([]*storepb.WebhooksUserSetting_Webhook, 0, len(webhooks.Webhooks))
			for _, webhook := range webhooks.Webhooks {
				storeWebhook := &storepb.WebhooksUserSetting_Webhook{
					Id:    extractWebhookIDFromName(webhook.Name),
					Title: webhook.DisplayName,
					Url:   webhook.Url,
				}
				storeWebhooks = append(storeWebhooks, storeWebhook)
			}
			storeSetting.Value = &storepb.UserSetting_Webhooks{
				Webhooks: &storepb.WebhooksUserSetting{
					Webhooks: storeWebhooks,
				},
			}
		} else {
			return nil, errors.Errorf("webhooks setting is required")
		}
	case storepb.UserSetting_TAGS:
		if tags := apiSetting.GetTagsSetting(); tags != nil {
			storeSetting.Value = &storepb.UserSetting_Tags{
				Tags: convertUserTagsSettingToStore(tags),
			}
		} else {
			return nil, errors.Errorf("tags setting is required")
		}
	default:
		return nil, errors.Errorf("unsupported setting key: %v", key)
	}

	return storeSetting, nil
}

// extractWebhookIDFromName extracts webhook ID from resource name.
// e.g., "users/123/webhooks/webhook-id" -> "webhook-id".
