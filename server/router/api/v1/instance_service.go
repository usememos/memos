package v1

import (
	"context"
	"fmt"
	"math"
	"regexp"
	"slices"
	"strings"

	"github.com/lithammer/shortuuid/v4"
	"github.com/pkg/errors"
	colorpb "google.golang.org/genproto/googleapis/type/color"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	v1pb "github.com/usememos/memos/proto/gen/api/v1"
	storepb "github.com/usememos/memos/proto/gen/store"
	"github.com/usememos/memos/store"
)

// GetInstanceProfile returns the instance profile.
func (s *APIV1Service) GetInstanceProfile(ctx context.Context, _ *v1pb.GetInstanceProfileRequest) (*v1pb.InstanceProfile, error) {
	admin, err := s.GetInstanceAdmin(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get instance admin: %v", err)
	}

	instanceProfile := &v1pb.InstanceProfile{
		Version:     s.Profile.Version,
		Demo:        s.Profile.Demo,
		InstanceUrl: s.Profile.InstanceURL,
		Admin:       admin, // nil when not initialized
	}
	return instanceProfile, nil
}

func (s *APIV1Service) GetInstanceSetting(ctx context.Context, request *v1pb.GetInstanceSettingRequest) (*v1pb.InstanceSetting, error) {
	instanceSettingKeyString, err := ExtractInstanceSettingKeyFromName(request.Name)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid instance setting name: %v", err)
	}

	instanceSettingKey := storepb.InstanceSettingKey(storepb.InstanceSettingKey_value[instanceSettingKeyString])
	// Get instance setting from store with default value.
	switch instanceSettingKey {
	case storepb.InstanceSettingKey_BASIC:
		_, err = s.Store.GetInstanceBasicSetting(ctx)
	case storepb.InstanceSettingKey_GENERAL:
		_, err = s.Store.GetInstanceGeneralSetting(ctx)
	case storepb.InstanceSettingKey_MEMO_RELATED:
		_, err = s.Store.GetInstanceMemoRelatedSetting(ctx)
	case storepb.InstanceSettingKey_STORAGE:
		_, err = s.Store.GetInstanceStorageSetting(ctx)
	case storepb.InstanceSettingKey_TAGS:
		_, err = s.Store.GetInstanceTagsSetting(ctx)
	case storepb.InstanceSettingKey_NOTIFICATION:
		_, err = s.Store.GetInstanceNotificationSetting(ctx)
	case storepb.InstanceSettingKey_AI:
		_, err = s.Store.GetInstanceAISetting(ctx)
	default:
		return nil, status.Errorf(codes.InvalidArgument, "unsupported instance setting key: %v", instanceSettingKey)
	}
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get instance setting: %v", err)
	}

	instanceSetting, err := s.Store.GetInstanceSetting(ctx, &store.FindInstanceSetting{
		Name: instanceSettingKey.String(),
	})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get instance setting: %v", err)
	}
	if instanceSetting == nil {
		return nil, status.Errorf(codes.NotFound, "instance setting not found")
	}

	// Storage, notification, and AI settings contain credentials; restrict to admins only.
	if instanceSetting.Key == storepb.InstanceSettingKey_STORAGE ||
		instanceSetting.Key == storepb.InstanceSettingKey_NOTIFICATION ||
		instanceSetting.Key == storepb.InstanceSettingKey_AI {
		user, err := s.fetchCurrentUser(ctx)
		if err != nil {
			return nil, status.Errorf(codes.Internal, "failed to get current user: %v", err)
		}
		if user == nil {
			return nil, status.Errorf(codes.Unauthenticated, "user not authenticated")
		}
		if user.Role != store.RoleAdmin {
			return nil, status.Errorf(codes.PermissionDenied, "permission denied")
		}
	}

	return convertInstanceSettingFromStore(instanceSetting), nil
}

func (s *APIV1Service) UpdateInstanceSetting(ctx context.Context, request *v1pb.UpdateInstanceSettingRequest) (*v1pb.InstanceSetting, error) {
	user, err := s.fetchCurrentUser(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get current user: %v", err)
	}
	if user == nil {
		return nil, status.Errorf(codes.Unauthenticated, "user not authenticated")
	}
	if user.Role != store.RoleAdmin {
		return nil, status.Errorf(codes.PermissionDenied, "permission denied")
	}

	// TODO: Apply update_mask if specified
	_ = request.UpdateMask

	if err := validateInstanceSetting(request.Setting); err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid instance setting: %v", err)
	}

	updateSetting := convertInstanceSettingToStore(request.Setting)

	// Preserve write-only credential fields when the caller sends an empty value.
	// An empty string means "no change", not "clear the credential".
	switch updateSetting.Key {
	case storepb.InstanceSettingKey_NOTIFICATION:
		if notif := updateSetting.GetNotificationSetting(); notif != nil && notif.Email != nil && notif.Email.SmtpPassword == "" {
			existing, err := s.Store.GetInstanceNotificationSetting(ctx)
			if err == nil && existing != nil && existing.Email != nil {
				notif.Email.SmtpPassword = existing.Email.SmtpPassword
			}
		}
	case storepb.InstanceSettingKey_STORAGE:
		if storage := updateSetting.GetStorageSetting(); storage != nil && storage.S3Config != nil && storage.S3Config.AccessKeySecret == "" {
			existing, err := s.Store.GetInstanceStorageSetting(ctx)
			if err == nil && existing != nil && existing.S3Config != nil {
				storage.S3Config.AccessKeySecret = existing.S3Config.AccessKeySecret
			}
		}
	case storepb.InstanceSettingKey_AI:
		if err := s.prepareInstanceAISettingForUpdate(ctx, updateSetting.GetAiSetting()); err != nil {
			return nil, status.Errorf(codes.InvalidArgument, "invalid AI setting: %v", err)
		}
	default:
		// No credential preservation needed for other setting types.
	}

	instanceSetting, err := s.Store.UpsertInstanceSetting(ctx, updateSetting)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to upsert instance setting: %v", err)
	}

	return convertInstanceSettingFromStore(instanceSetting), nil
}

func convertInstanceSettingFromStore(setting *storepb.InstanceSetting) *v1pb.InstanceSetting {
	instanceSetting := &v1pb.InstanceSetting{
		Name: fmt.Sprintf("instance/settings/%s", setting.Key.String()),
	}
	switch setting.Value.(type) {
	case *storepb.InstanceSetting_GeneralSetting:
		instanceSetting.Value = &v1pb.InstanceSetting_GeneralSetting_{
			GeneralSetting: convertInstanceGeneralSettingFromStore(setting.GetGeneralSetting()),
		}
	case *storepb.InstanceSetting_StorageSetting:
		instanceSetting.Value = &v1pb.InstanceSetting_StorageSetting_{
			StorageSetting: convertInstanceStorageSettingFromStore(setting.GetStorageSetting()),
		}
	case *storepb.InstanceSetting_MemoRelatedSetting:
		instanceSetting.Value = &v1pb.InstanceSetting_MemoRelatedSetting_{
			MemoRelatedSetting: convertInstanceMemoRelatedSettingFromStore(setting.GetMemoRelatedSetting()),
		}
	case *storepb.InstanceSetting_TagsSetting:
		instanceSetting.Value = &v1pb.InstanceSetting_TagsSetting_{
			TagsSetting: convertInstanceTagsSettingFromStore(setting.GetTagsSetting()),
		}
	case *storepb.InstanceSetting_NotificationSetting:
		instanceSetting.Value = &v1pb.InstanceSetting_NotificationSetting_{
			NotificationSetting: convertInstanceNotificationSettingFromStore(setting.GetNotificationSetting()),
		}
	case *storepb.InstanceSetting_AiSetting:
		instanceSetting.Value = &v1pb.InstanceSetting_AiSetting{
			AiSetting: convertInstanceAISettingFromStore(setting.GetAiSetting()),
		}
	default:
		// Leave Value unset for unsupported setting variants.
	}
	return instanceSetting
}

func convertInstanceSettingToStore(setting *v1pb.InstanceSetting) *storepb.InstanceSetting {
	settingKeyString, _ := ExtractInstanceSettingKeyFromName(setting.Name)
	instanceSetting := &storepb.InstanceSetting{
		Key: storepb.InstanceSettingKey(storepb.InstanceSettingKey_value[settingKeyString]),
		Value: &storepb.InstanceSetting_GeneralSetting{
			GeneralSetting: convertInstanceGeneralSettingToStore(setting.GetGeneralSetting()),
		},
	}
	switch instanceSetting.Key {
	case storepb.InstanceSettingKey_GENERAL:
		instanceSetting.Value = &storepb.InstanceSetting_GeneralSetting{
			GeneralSetting: convertInstanceGeneralSettingToStore(setting.GetGeneralSetting()),
		}
	case storepb.InstanceSettingKey_STORAGE:
		instanceSetting.Value = &storepb.InstanceSetting_StorageSetting{
			StorageSetting: convertInstanceStorageSettingToStore(setting.GetStorageSetting()),
		}
	case storepb.InstanceSettingKey_MEMO_RELATED:
		instanceSetting.Value = &storepb.InstanceSetting_MemoRelatedSetting{
			MemoRelatedSetting: convertInstanceMemoRelatedSettingToStore(setting.GetMemoRelatedSetting()),
		}
	case storepb.InstanceSettingKey_TAGS:
		instanceSetting.Value = &storepb.InstanceSetting_TagsSetting{
			TagsSetting: convertInstanceTagsSettingToStore(setting.GetTagsSetting()),
		}
	case storepb.InstanceSettingKey_NOTIFICATION:
		instanceSetting.Value = &storepb.InstanceSetting_NotificationSetting{
			NotificationSetting: convertInstanceNotificationSettingToStore(setting.GetNotificationSetting()),
		}
	case storepb.InstanceSettingKey_AI:
		instanceSetting.Value = &storepb.InstanceSetting_AiSetting{
			AiSetting: convertInstanceAISettingToStore(setting.GetAiSetting()),
		}
	default:
		// Keep the default GeneralSetting value
	}
	return instanceSetting
}

func convertInstanceGeneralSettingFromStore(setting *storepb.InstanceGeneralSetting) *v1pb.InstanceSetting_GeneralSetting {
	if setting == nil {
		return nil
	}

	generalSetting := &v1pb.InstanceSetting_GeneralSetting{
		DisallowUserRegistration: setting.DisallowUserRegistration,
		DisallowPasswordAuth:     setting.DisallowPasswordAuth,
		AdditionalScript:         setting.AdditionalScript,
		AdditionalStyle:          setting.AdditionalStyle,
		WeekStartDayOffset:       setting.WeekStartDayOffset,
		DisallowChangeUsername:   setting.DisallowChangeUsername,
		DisallowChangeNickname:   setting.DisallowChangeNickname,
	}
	if setting.CustomProfile != nil {
		generalSetting.CustomProfile = &v1pb.InstanceSetting_GeneralSetting_CustomProfile{
			Title:       setting.CustomProfile.Title,
			Description: setting.CustomProfile.Description,
			LogoUrl:     setting.CustomProfile.LogoUrl,
		}
	}
	return generalSetting
}

func convertInstanceGeneralSettingToStore(setting *v1pb.InstanceSetting_GeneralSetting) *storepb.InstanceGeneralSetting {
	if setting == nil {
		return nil
	}
	generalSetting := &storepb.InstanceGeneralSetting{
		DisallowUserRegistration: setting.DisallowUserRegistration,
		DisallowPasswordAuth:     setting.DisallowPasswordAuth,
		AdditionalScript:         setting.AdditionalScript,
		AdditionalStyle:          setting.AdditionalStyle,
		WeekStartDayOffset:       setting.WeekStartDayOffset,
		DisallowChangeUsername:   setting.DisallowChangeUsername,
		DisallowChangeNickname:   setting.DisallowChangeNickname,
	}
	if setting.CustomProfile != nil {
		generalSetting.CustomProfile = &storepb.InstanceCustomProfile{
			Title:       setting.CustomProfile.Title,
			Description: setting.CustomProfile.Description,
			LogoUrl:     setting.CustomProfile.LogoUrl,
		}
	}
	return generalSetting
}

func convertInstanceStorageSettingFromStore(settingpb *storepb.InstanceStorageSetting) *v1pb.InstanceSetting_StorageSetting {
	if settingpb == nil {
		return nil
	}
	setting := &v1pb.InstanceSetting_StorageSetting{
		StorageType:       v1pb.InstanceSetting_StorageSetting_StorageType(settingpb.StorageType),
		FilepathTemplate:  settingpb.FilepathTemplate,
		UploadSizeLimitMb: settingpb.UploadSizeLimitMb,
	}
	if settingpb.S3Config != nil {
		setting.S3Config = &v1pb.InstanceSetting_StorageSetting_S3Config{
			AccessKeyId: settingpb.S3Config.AccessKeyId,
			// AccessKeySecret is write-only: never returned in responses.
			Endpoint:     settingpb.S3Config.Endpoint,
			Region:       settingpb.S3Config.Region,
			Bucket:       settingpb.S3Config.Bucket,
			UsePathStyle: settingpb.S3Config.UsePathStyle,
		}
	}
	return setting
}

func convertInstanceStorageSettingToStore(setting *v1pb.InstanceSetting_StorageSetting) *storepb.InstanceStorageSetting {
	if setting == nil {
		return nil
	}
	settingpb := &storepb.InstanceStorageSetting{
		StorageType:       storepb.InstanceStorageSetting_StorageType(setting.StorageType),
		FilepathTemplate:  setting.FilepathTemplate,
		UploadSizeLimitMb: setting.UploadSizeLimitMb,
	}
	if setting.S3Config != nil {
		settingpb.S3Config = &storepb.StorageS3Config{
			AccessKeyId:     setting.S3Config.AccessKeyId,
			AccessKeySecret: setting.S3Config.AccessKeySecret,
			Endpoint:        setting.S3Config.Endpoint,
			Region:          setting.S3Config.Region,
			Bucket:          setting.S3Config.Bucket,
			UsePathStyle:    setting.S3Config.UsePathStyle,
		}
	}
	return settingpb
}

func convertInstanceMemoRelatedSettingFromStore(setting *storepb.InstanceMemoRelatedSetting) *v1pb.InstanceSetting_MemoRelatedSetting {
	if setting == nil {
		return nil
	}
	return &v1pb.InstanceSetting_MemoRelatedSetting{
		DisplayWithUpdateTime: setting.DisplayWithUpdateTime,
		ContentLengthLimit:    setting.ContentLengthLimit,
		EnableDoubleClickEdit: setting.EnableDoubleClickEdit,
		Reactions:             setting.Reactions,
	}
}

func convertInstanceMemoRelatedSettingToStore(setting *v1pb.InstanceSetting_MemoRelatedSetting) *storepb.InstanceMemoRelatedSetting {
	if setting == nil {
		return nil
	}
	return &storepb.InstanceMemoRelatedSetting{
		DisplayWithUpdateTime: setting.DisplayWithUpdateTime,
		ContentLengthLimit:    setting.ContentLengthLimit,
		EnableDoubleClickEdit: setting.EnableDoubleClickEdit,
		Reactions:             setting.Reactions,
	}
}

func convertInstanceTagsSettingFromStore(setting *storepb.InstanceTagsSetting) *v1pb.InstanceSetting_TagsSetting {
	if setting == nil {
		return nil
	}
	tags := make(map[string]*v1pb.InstanceSetting_TagMetadata, len(setting.Tags))
	for tag, metadata := range setting.Tags {
		tags[tag] = &v1pb.InstanceSetting_TagMetadata{
			BackgroundColor: metadata.GetBackgroundColor(),
			BlurContent:     metadata.GetBlurContent(),
		}
	}
	return &v1pb.InstanceSetting_TagsSetting{
		Tags: tags,
	}
}

func convertInstanceTagsSettingToStore(setting *v1pb.InstanceSetting_TagsSetting) *storepb.InstanceTagsSetting {
	if setting == nil {
		return nil
	}
	tags := make(map[string]*storepb.InstanceTagMetadata, len(setting.Tags))
	for tag, metadata := range setting.Tags {
		tags[tag] = &storepb.InstanceTagMetadata{
			BackgroundColor: metadata.GetBackgroundColor(),
			BlurContent:     metadata.GetBlurContent(),
		}
	}
	return &storepb.InstanceTagsSetting{
		Tags: tags,
	}
}

func convertInstanceNotificationSettingFromStore(setting *storepb.InstanceNotificationSetting) *v1pb.InstanceSetting_NotificationSetting {
	if setting == nil {
		return nil
	}

	notificationSetting := &v1pb.InstanceSetting_NotificationSetting{}
	if setting.Email != nil {
		notificationSetting.Email = &v1pb.InstanceSetting_NotificationSetting_EmailSetting{
			Enabled:      setting.Email.Enabled,
			SmtpHost:     setting.Email.SmtpHost,
			SmtpPort:     setting.Email.SmtpPort,
			SmtpUsername: setting.Email.SmtpUsername,
			// SmtpPassword is write-only: never returned in responses.
			FromEmail: setting.Email.FromEmail,
			FromName:  setting.Email.FromName,
			ReplyTo:   setting.Email.ReplyTo,
			UseTls:    setting.Email.UseTls,
			UseSsl:    setting.Email.UseSsl,
		}
	}
	return notificationSetting
}

func convertInstanceNotificationSettingToStore(setting *v1pb.InstanceSetting_NotificationSetting) *storepb.InstanceNotificationSetting {
	if setting == nil {
		return nil
	}

	notificationSetting := &storepb.InstanceNotificationSetting{}
	if setting.Email != nil {
		notificationSetting.Email = &storepb.InstanceNotificationSetting_EmailSetting{
			Enabled:      setting.Email.Enabled,
			SmtpHost:     setting.Email.SmtpHost,
			SmtpPort:     setting.Email.SmtpPort,
			SmtpUsername: setting.Email.SmtpUsername,
			SmtpPassword: setting.Email.SmtpPassword,
			FromEmail:    setting.Email.FromEmail,
			FromName:     setting.Email.FromName,
			ReplyTo:      setting.Email.ReplyTo,
			UseTls:       setting.Email.UseTls,
			UseSsl:       setting.Email.UseSsl,
		}
	}
	return notificationSetting
}

func convertInstanceAISettingFromStore(setting *storepb.InstanceAISetting) *v1pb.InstanceSetting_AISetting {
	if setting == nil {
		return nil
	}

	aiSetting := &v1pb.InstanceSetting_AISetting{
		Providers: make([]*v1pb.InstanceSetting_AIProviderConfig, 0, len(setting.Providers)),
	}
	for _, provider := range setting.Providers {
		if provider == nil {
			continue
		}
		apiKey := provider.GetApiKey()
		aiSetting.Providers = append(aiSetting.Providers, &v1pb.InstanceSetting_AIProviderConfig{
			Id:           provider.GetId(),
			Title:        provider.GetTitle(),
			Type:         v1pb.InstanceSetting_AIProviderType(provider.GetType()),
			Endpoint:     provider.GetEndpoint(),
			Models:       provider.GetModels(),
			DefaultModel: provider.GetDefaultModel(),
			ApiKeySet:    apiKey != "",
			ApiKeyHint:   maskAPIKey(apiKey),
		})
	}
	return aiSetting
}

func convertInstanceAISettingToStore(setting *v1pb.InstanceSetting_AISetting) *storepb.InstanceAISetting {
	if setting == nil {
		return nil
	}

	aiSetting := &storepb.InstanceAISetting{
		Providers: make([]*storepb.AIProviderConfig, 0, len(setting.Providers)),
	}
	for _, provider := range setting.Providers {
		if provider == nil {
			continue
		}
		aiSetting.Providers = append(aiSetting.Providers, &storepb.AIProviderConfig{
			Id:           provider.GetId(),
			Title:        provider.GetTitle(),
			Type:         storepb.AIProviderType(provider.GetType()),
			Endpoint:     provider.GetEndpoint(),
			ApiKey:       provider.GetApiKey(),
			Models:       provider.GetModels(),
			DefaultModel: provider.GetDefaultModel(),
		})
	}
	return aiSetting
}

func validateInstanceSetting(setting *v1pb.InstanceSetting) error {
	key, err := ExtractInstanceSettingKeyFromName(setting.Name)
	if err != nil {
		return err
	}
	if key != storepb.InstanceSettingKey_TAGS.String() {
		return nil
	}
	return validateInstanceTagsSetting(setting.GetTagsSetting())
}

func (s *APIV1Service) prepareInstanceAISettingForUpdate(ctx context.Context, setting *storepb.InstanceAISetting) error {
	if setting == nil {
		return errors.New("AI setting is required")
	}

	existing, err := s.Store.GetInstanceAISetting(ctx)
	if err != nil {
		return errors.Wrap(err, "failed to get existing AI setting")
	}
	existingProviders := map[string]*storepb.AIProviderConfig{}
	if existing != nil {
		for _, provider := range existing.Providers {
			if provider != nil && provider.Id != "" {
				existingProviders[provider.Id] = provider
			}
		}
	}

	seenIDs := map[string]bool{}
	for _, provider := range setting.Providers {
		if provider == nil {
			return errors.New("provider cannot be nil")
		}

		provider.Id = strings.TrimSpace(provider.Id)
		if provider.Id == "" {
			provider.Id = shortuuid.New()
		}
		if seenIDs[provider.Id] {
			return errors.Errorf("duplicate provider ID %q", provider.Id)
		}
		seenIDs[provider.Id] = true

		provider.Title = strings.TrimSpace(provider.Title)
		if provider.Title == "" {
			return errors.New("provider title is required")
		}
		if provider.Type == storepb.AIProviderType_AI_PROVIDER_TYPE_UNSPECIFIED {
			return errors.Errorf("provider %q type is required", provider.Id)
		}

		provider.Endpoint = strings.TrimSpace(provider.Endpoint)
		if provider.Type == storepb.AIProviderType_OPENAI && provider.Endpoint == "" {
			provider.Endpoint = "https://api.openai.com/v1"
		}
		if provider.Type == storepb.AIProviderType_ANTHROPIC && provider.Endpoint == "" {
			provider.Endpoint = "https://api.anthropic.com/v1"
		}
		if provider.Type == storepb.AIProviderType_OPENAI_COMPATIBLE && provider.Endpoint == "" {
			return errors.Errorf("provider %q endpoint is required", provider.Id)
		}

		provider.Models = normalizeAIModels(provider.Models)
		if len(provider.Models) == 0 {
			return errors.Errorf("provider %q must define at least one model", provider.Id)
		}
		provider.DefaultModel = strings.TrimSpace(provider.DefaultModel)
		if provider.DefaultModel == "" {
			provider.DefaultModel = provider.Models[0]
		}
		if !slices.Contains(provider.Models, provider.DefaultModel) {
			return errors.Errorf("provider %q default model %q must be included in models", provider.Id, provider.DefaultModel)
		}

		if provider.ApiKey == "" {
			if existingProvider, ok := existingProviders[provider.Id]; ok {
				provider.ApiKey = existingProvider.ApiKey
			}
		}
		if provider.ApiKey == "" {
			return errors.Errorf("provider %q API key is required", provider.Id)
		}
	}
	return nil
}

func normalizeAIModels(models []string) []string {
	normalized := []string{}
	seen := map[string]bool{}
	for _, model := range models {
		model = strings.TrimSpace(model)
		if model == "" || seen[model] {
			continue
		}
		seen[model] = true
		normalized = append(normalized, model)
	}
	return normalized
}

func maskAPIKey(apiKey string) string {
	if apiKey == "" {
		return ""
	}
	if len(apiKey) <= 8 {
		return "..."
	}
	prefixLength := min(4, len(apiKey))
	return apiKey[:prefixLength] + "..." + apiKey[len(apiKey)-4:]
}

func validateInstanceTagsSetting(setting *v1pb.InstanceSetting_TagsSetting) error {
	if setting == nil {
		return errors.New("tags setting is required")
	}
	for tag, metadata := range setting.Tags {
		if strings.TrimSpace(tag) == "" {
			return errors.New("tag key cannot be empty")
		}
		if _, err := regexp.Compile(tag); err != nil {
			return errors.Errorf("tag key %q is not a valid regex pattern: %v", tag, err)
		}
		if metadata == nil {
			return errors.Errorf("tag metadata is required for %q", tag)
		}
		if metadata.GetBackgroundColor() != nil {
			if err := validateInstanceColor(metadata.GetBackgroundColor()); err != nil {
				return errors.Wrapf(err, "background_color for %q", tag)
			}
		}
	}
	return nil
}

func validateInstanceColor(color *colorpb.Color) error {
	if err := validateInstanceColorComponent("red", color.GetRed()); err != nil {
		return err
	}
	if err := validateInstanceColorComponent("green", color.GetGreen()); err != nil {
		return err
	}
	if err := validateInstanceColorComponent("blue", color.GetBlue()); err != nil {
		return err
	}
	if alpha := color.GetAlpha(); alpha != nil {
		if err := validateInstanceColorComponent("alpha", alpha.GetValue()); err != nil {
			return err
		}
	}
	return nil
}

func validateInstanceColorComponent(name string, value float32) error {
	if math.IsNaN(float64(value)) || math.IsInf(float64(value), 0) {
		return errors.Errorf("%s must be a finite number", name)
	}
	if value < 0 || value > 1 {
		return errors.Errorf("%s must be between 0 and 1", name)
	}
	return nil
}

func (s *APIV1Service) GetInstanceAdmin(ctx context.Context) (*v1pb.User, error) {
	adminUserType := store.RoleAdmin
	user, err := s.Store.GetUser(ctx, &store.FindUser{
		Role: &adminUserType,
	})
	if err != nil {
		return nil, errors.Wrapf(err, "failed to find admin")
	}
	if user == nil {
		return nil, nil
	}

	currentUser, _ := s.fetchCurrentUser(ctx)
	return convertUserFromStore(user, currentUser), nil
}
