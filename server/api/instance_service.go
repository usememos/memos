package api

import (
	"context"
	"log/slog"
	"strings"

	"github.com/pkg/errors"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/proto"
	"google.golang.org/protobuf/types/known/emptypb"

	"github.com/usememos/memos/core/configuration"
	"github.com/usememos/memos/core/instancesetting"
	"github.com/usememos/memos/core/notification"
	apipb "github.com/usememos/memos/proto/gen/api"
	storepb "github.com/usememos/memos/proto/gen/store"
	"github.com/usememos/memos/store"
)

const maxBatchGetInstanceSettings = 100

type instanceSettingCaller struct {
	user   *store.User
	loaded bool
}

func (c *instanceSettingCaller) currentUser(ctx context.Context, service *APIService) (*store.User, error) {
	if c.loaded {
		return c.user, nil
	}
	user, err := service.fetchCurrentUser(ctx)
	if err != nil {
		return nil, err
	}
	c.user = user
	c.loaded = true
	return c.user, nil
}

// GetInstanceProfile returns the instance profile.
func (s *APIService) GetInstanceProfile(ctx context.Context, _ *apipb.GetInstanceProfileRequest) (*apipb.InstanceProfile, error) {
	currentUser, err := s.fetchCurrentUser(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get current user: %v", err)
	}
	admin, err := s.getInstanceAdmin(ctx, currentUser)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get instance admin: %v", err)
	}

	// needs_setup reflects whether the instance has any users at all, which is
	// the real signal for first-run setup. It is deliberately independent of the
	// admin lookup: an instance that has lost its admins still has users and must
	// not be treated as a fresh install.
	limitOne := 1
	users, err := s.Store.ListUsers(ctx, &store.FindUser{Limit: &limitOne})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to list users: %v", err)
	}
	accessSetting, err := s.Store.GetInstanceAccessSetting(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get instance access setting: %v", err)
	}

	instanceProfile := &apipb.InstanceProfile{
		Version:     s.Profile.Version,
		Demo:        s.Profile.Demo,
		InstanceUrl: s.Profile.InstanceURL,
		Admin:       admin, // signed-in callers only; may be nil even on a populated instance
		Commit:      s.Profile.Commit,
		NeedsSetup:  len(users) == 0,
		AccessMode:  instancesetting.AccessModeFromStore(accessSetting.AccessMode),
		Challenge:   s.challengeProfile(),
	}
	return instanceProfile, nil
}

func (s *APIService) GetInstanceSetting(ctx context.Context, request *apipb.GetInstanceSettingRequest) (*apipb.InstanceSetting, error) {
	return s.getInstanceSettingByName(ctx, request.Name, &instanceSettingCaller{})
}

// BatchGetInstanceSettings returns multiple instance settings in request order.
func (s *APIService) BatchGetInstanceSettings(ctx context.Context, request *apipb.BatchGetInstanceSettingsRequest) (*apipb.BatchGetInstanceSettingsResponse, error) {
	if len(request.Names) > maxBatchGetInstanceSettings {
		return nil, status.Errorf(codes.InvalidArgument, "too many instance setting names (max %d)", maxBatchGetInstanceSettings)
	}

	caller := &instanceSettingCaller{}
	settings := make([]*apipb.InstanceSetting, 0, len(request.Names))
	for _, name := range request.Names {
		setting, err := s.getInstanceSettingByName(ctx, name, caller)
		if err != nil {
			return nil, err
		}
		settings = append(settings, setting)
	}

	return &apipb.BatchGetInstanceSettingsResponse{InstanceSettings: settings}, nil
}

func (s *APIService) getInstanceSettingByName(ctx context.Context, name string, caller *instanceSettingCaller) (*apipb.InstanceSetting, error) {
	instanceSettingKeyString, err := ExtractInstanceSettingKeyFromName(name)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid instance setting name: %v", err)
	}

	instanceSettingKey := storepb.InstanceSettingKey(storepb.InstanceSettingKey_value[instanceSettingKeyString])
	// Get instance setting from store with default value.
	var instanceSetting *storepb.InstanceSetting
	switch instanceSettingKey {
	case storepb.InstanceSettingKey_BASIC:
		var setting *storepb.InstanceBasicSetting
		setting, err = s.Store.GetInstanceBasicSetting(ctx)
		instanceSetting = &storepb.InstanceSetting{Key: instanceSettingKey, Value: &storepb.InstanceSetting_BasicSetting{BasicSetting: setting}}
	case storepb.InstanceSettingKey_GENERAL:
		var setting *storepb.InstanceGeneralSetting
		setting, err = s.Store.GetInstanceGeneralSetting(ctx)
		instanceSetting = &storepb.InstanceSetting{Key: instanceSettingKey, Value: &storepb.InstanceSetting_GeneralSetting{GeneralSetting: setting}}
	case storepb.InstanceSettingKey_MEMO_RELATED:
		var setting *storepb.InstanceMemoRelatedSetting
		setting, err = s.Store.GetInstanceMemoRelatedSetting(ctx)
		instanceSetting = &storepb.InstanceSetting{Key: instanceSettingKey, Value: &storepb.InstanceSetting_MemoRelatedSetting{MemoRelatedSetting: setting}}
	case storepb.InstanceSettingKey_STORAGE:
		var setting *storepb.InstanceStorageSetting
		setting, err = s.Store.GetInstanceStorageSetting(ctx)
		instanceSetting = &storepb.InstanceSetting{Key: instanceSettingKey, Value: &storepb.InstanceSetting_StorageSetting{StorageSetting: setting}}
	case storepb.InstanceSettingKey_TAGS:
		var setting *storepb.InstanceTagsSetting
		setting, err = s.Store.GetInstanceTagsSetting(ctx)
		instanceSetting = &storepb.InstanceSetting{Key: instanceSettingKey, Value: &storepb.InstanceSetting_TagsSetting{TagsSetting: setting}}
	case storepb.InstanceSettingKey_NOTIFICATION:
		var setting *storepb.InstanceNotificationSetting
		setting, err = s.Store.GetInstanceNotificationSetting(ctx)
		instanceSetting = &storepb.InstanceSetting{Key: instanceSettingKey, Value: &storepb.InstanceSetting_NotificationSetting{NotificationSetting: setting}}
	case storepb.InstanceSettingKey_AI:
		var setting *storepb.InstanceAISetting
		setting, err = s.Store.GetInstanceAISetting(ctx)
		instanceSetting = &storepb.InstanceSetting{Key: instanceSettingKey, Value: &storepb.InstanceSetting_AiSetting{AiSetting: setting}}
	case storepb.InstanceSettingKey_ACCESS:
		var setting *storepb.InstanceAccessSetting
		setting, err = s.Store.GetInstanceAccessSetting(ctx)
		instanceSetting = &storepb.InstanceSetting{Key: instanceSettingKey, Value: &storepb.InstanceSetting_AccessSetting{AccessSetting: setting}}
	case storepb.InstanceSettingKey_USAGE_LIMITS:
		var setting *storepb.InstanceUsageLimitsSetting
		setting, err = s.Store.GetInstanceUsageLimitsSetting(ctx)
		instanceSetting = &storepb.InstanceSetting{Key: instanceSettingKey, Value: &storepb.InstanceSetting_UsageLimitsSetting{UsageLimitsSetting: setting}}
	default:
		return nil, status.Errorf(codes.InvalidArgument, "unsupported instance setting key: %v", instanceSettingKey)
	}
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get instance setting: %v", err)
	}

	// Storage and notification settings contain credentials, and usage limits
	// name users; restrict them to admins.
	if instanceSetting.Key == storepb.InstanceSettingKey_STORAGE ||
		instanceSetting.Key == storepb.InstanceSettingKey_NOTIFICATION ||
		instanceSetting.Key == storepb.InstanceSettingKey_USAGE_LIMITS {
		user, err := caller.currentUser(ctx, s)
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
	isAdminCaller := false
	if instanceSetting.Key == storepb.InstanceSettingKey_AI {
		user, err := caller.currentUser(ctx, s)
		if err != nil {
			return nil, status.Errorf(codes.Internal, "failed to get current user: %v", err)
		}
		if user == nil {
			return nil, status.Errorf(codes.Unauthenticated, "user not authenticated")
		}
		isAdminCaller = user.Role == store.RoleAdmin
	}

	result, err := s.convertInstanceSettingResponse(ctx, instanceSetting)
	if err != nil {
		return nil, err
	}
	if instanceSetting.Key == storepb.InstanceSettingKey_AI && !isAdminCaller {
		// Non-admin callers only need transcription.provider_id to gate the
		// editor's Transcribe button. Model / language / prompt are
		// admin-entered defaults that may contain proprietary glossary terms,
		// so they are redacted from non-admin responses.
		if ai := result.GetAiSetting(); ai != nil && ai.Transcription != nil {
			ai.Transcription.Model = ""
			ai.Transcription.Language = ""
			ai.Transcription.Prompt = ""
		}
	}
	return result, nil
}

func (s *APIService) UpdateInstanceSetting(ctx context.Context, request *apipb.UpdateInstanceSettingRequest) (*apipb.InstanceSetting, error) {
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
	if request.InstanceSetting == nil {
		return nil, status.Errorf(codes.InvalidArgument, "instance setting is required")
	}
	if _, err := ExtractInstanceSettingKeyFromName(request.InstanceSetting.Name); err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid instance setting name: %v", err)
	}
	// TODO: Apply update_mask if specified
	_ = request.UpdateMask

	updateSetting := instancesetting.ToStore(request.InstanceSetting)
	if updateSetting.Key == storepb.InstanceSettingKey_USAGE_LIMITS {
		usageLimits, err := s.convertUsageLimitsSettingToStore(ctx, request.InstanceSetting.GetUsageLimitsSetting())
		if err != nil {
			return nil, err
		}
		updateSetting.Value = &storepb.InstanceSetting_UsageLimitsSetting{UsageLimitsSetting: usageLimits}
	}

	// Preserve write-only credential fields when the caller sends an empty value.
	// An empty string means "no change", not "clear the credential".
	var existingSetting *storepb.InstanceSetting
	switch updateSetting.Key {
	case storepb.InstanceSettingKey_TAGS:
		if err := validateInstanceTagsSetting(request.InstanceSetting.GetTagsSetting()); err != nil {
			return nil, status.Errorf(codes.InvalidArgument, "invalid instance setting: %v", err)
		}
	case storepb.InstanceSettingKey_NOTIFICATION:
		if notif := updateSetting.GetNotificationSetting(); notif != nil && notif.Email != nil && notif.Email.SmtpPassword == "" {
			existing, err := s.Store.GetInstanceNotificationSetting(ctx)
			if err == nil && existing != nil && existing.Email != nil {
				if existing.Email.SmtpPassword != "" && !sameSMTPConnectionIdentity(notif.Email, existing.Email) {
					return nil, status.Errorf(codes.InvalidArgument, "smtp password is required when changing SMTP host, port, username, or encryption settings")
				}
				notif.Email.SmtpPassword = existing.Email.SmtpPassword
			}
		}
	case storepb.InstanceSettingKey_STORAGE:
		existing, err := s.Store.GetInstanceStorageSetting(ctx)
		if err != nil {
			// A corrupt stored setting must not block repair: treat it as unset so
			// a valid update can overwrite it.
			slog.Warn("failed to load existing storage setting; treating it as unset", "error", err)
			existing = nil
		}
		if err := store.PrepareInstanceStorageSettingUpdate(updateSetting.GetStorageSetting(), existing); err != nil {
			return nil, status.Errorf(codes.InvalidArgument, "invalid storage setting: %v", err)
		}
		existingSetting = &storepb.InstanceSetting{
			Key:   storepb.InstanceSettingKey_STORAGE,
			Value: &storepb.InstanceSetting_StorageSetting{StorageSetting: existing},
		}
	case storepb.InstanceSettingKey_AI:
		if err := s.prepareInstanceAISettingForUpdate(ctx, updateSetting.GetAiSetting()); err != nil {
			return nil, status.Errorf(codes.InvalidArgument, "invalid AI setting: %v", err)
		}
	default:
		// No credential preservation needed for other setting types.
	}
	if err := instancesetting.ValidateUpdate(updateSetting, existingSetting); err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid instance setting: %v", err)
	}
	if err := s.checkManagedSettingChange(ctx, updateSetting); err != nil {
		return nil, err
	}

	var instanceSetting *storepb.InstanceSetting
	if updateSetting.Key == storepb.InstanceSettingKey_GENERAL {
		instanceSetting, err = s.Store.UpsertInstanceGeneralSettingSafely(ctx, updateSetting)
	} else {
		instanceSetting, err = s.Store.UpsertInstanceSetting(ctx, updateSetting)
	}
	if err != nil {
		if errors.Is(err, store.ErrUnsafeAuthenticationConfiguration) {
			return nil, status.Error(codes.FailedPrecondition, err.Error())
		}
		if errors.Is(err, store.ErrInvalidUsageLimits) {
			return nil, status.Error(codes.InvalidArgument, err.Error())
		}
		return nil, status.Errorf(codes.Internal, "failed to upsert instance setting: %v", err)
	}

	return s.convertInstanceSettingResponse(ctx, instanceSetting)
}

// checkManagedSettingChange refuses an update that changes managed fields of
// a setting the configuration manages. It compares the stored value with the
// prepared update, so resending managed values unchanged passes.
func (s *APIService) checkManagedSettingChange(ctx context.Context, update *storepb.InstanceSetting) error {
	name := instancesetting.NamePrefix + update.Key.String()
	// Most settings are not managed; skip reading and diffing the stored value for those.
	state, err := s.Store.GetConfigurationState(ctx)
	if err != nil {
		return status.Errorf(codes.Internal, "failed to read the configuration state: %v", err)
	}
	if !configuration.Manages(state, name) {
		return nil
	}
	stored, err := s.Store.GetUncachedInstanceSetting(ctx, &store.FindInstanceSetting{Name: update.Key.String()})
	if err != nil {
		return status.Errorf(codes.Internal, "failed to read instance setting: %v", err)
	}
	var changed []string
	if update.Key == storepb.InstanceSettingKey_USAGE_LIMITS {
		// Usage limits name users only in the API form, so compare stored values.
		if !proto.Equal(stored.GetUsageLimitsSetting(), update.GetUsageLimitsSetting()) {
			changed = []string{"usageLimitsSetting"}
		}
	} else {
		var before proto.Message
		if stored != nil {
			before = instancesetting.FromStore(stored)
		}
		changed = configuration.ChangedPaths(before, instancesetting.FromStore(update))
	}
	return managedStatus(configuration.CheckChange(state, name, changed))
}

// challengeProfile describes the configured challenge so the web app can
// render the matching widget, or nil when none is configured.
func (s *APIService) challengeProfile() *apipb.InstanceProfile_Challenge {
	if s.Challenge == nil {
		return nil
	}
	return &apipb.InstanceProfile_Challenge{
		Provider: s.Challenge.Provider(),
		SiteKey:  s.Challenge.SiteKey(),
	}
}

func (s *APIService) TestInstanceEmailSetting(ctx context.Context, request *apipb.TestInstanceEmailSettingRequest) (*emptypb.Empty, error) {
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

	emailSetting, err := s.resolveTestEmailSetting(ctx, request.Email)
	if err != nil {
		return nil, err
	}

	recipientEmail := strings.TrimSpace(request.RecipientEmail)
	if recipientEmail == "" {
		recipientEmail = strings.TrimSpace(user.Email)
	}
	if recipientEmail == "" {
		return nil, status.Errorf(codes.InvalidArgument, "recipient email is required")
	}

	if err := notification.ValidateEmailSetting(emailSetting); err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid notification email setting: %v", err)
	}

	if err := notification.SendTestEmail(emailSetting, recipientEmail); err != nil {
		return nil, status.Errorf(codes.Internal, "failed to send test email: %v. Check that the SMTP port matches encryption: Gmail uses port 587 with STARTTLS on and SSL/TLS off; port 465 requires SSL/TLS on", err)
	}

	return &emptypb.Empty{}, nil
}

func (s *APIService) resolveTestEmailSetting(ctx context.Context, requestEmail *apipb.InstanceSetting_NotificationSetting_EmailSetting) (*storepb.InstanceNotificationSetting_EmailSetting, error) {
	if requestEmail == nil {
		existing, err := s.Store.GetInstanceNotificationSetting(ctx)
		if err != nil {
			return nil, status.Errorf(codes.Internal, "failed to get notification setting: %v", err)
		}
		return existing.GetEmail(), nil
	}

	emailSetting := instancesetting.NotificationSettingToStore(&apipb.InstanceSetting_NotificationSetting{Email: requestEmail}).GetEmail()
	if emailSetting.SmtpPassword != "" {
		return emailSetting, nil
	}

	existing, err := s.Store.GetInstanceNotificationSetting(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get notification setting: %v", err)
	}
	existingEmail := existing.GetEmail()
	if existingEmail == nil || existingEmail.SmtpPassword == "" {
		return emailSetting, nil
	}
	if sameSMTPConnectionIdentity(emailSetting, existingEmail) {
		emailSetting.SmtpPassword = existingEmail.SmtpPassword
		return emailSetting, nil
	}
	return nil, status.Errorf(codes.InvalidArgument, "smtp password is required when changing SMTP host, port, username, or encryption settings")
}

func sameSMTPConnectionIdentity(setting, existing *storepb.InstanceNotificationSetting_EmailSetting) bool {
	if setting == nil || existing == nil {
		return false
	}
	return strings.TrimSpace(setting.SmtpHost) == strings.TrimSpace(existing.SmtpHost) &&
		setting.SmtpPort == existing.SmtpPort &&
		strings.TrimSpace(setting.SmtpUsername) == strings.TrimSpace(existing.SmtpUsername) &&
		setting.UseTls == existing.UseTls &&
		setting.UseSsl == existing.UseSsl
}

// getInstanceAdmin returns the first admin of the instance as seen by viewer,
// or nil when the instance has no admin.
//
// A nil viewer is an anonymous caller and always gets nil: the profile endpoint
// is reachable without authentication so the sign-in page can render, and an
// anonymous visitor must not learn the login identifier of the most privileged
// account, especially on a private instance.
func (s *APIService) getInstanceAdmin(ctx context.Context, viewer *store.User) (*apipb.User, error) {
	if viewer == nil {
		return nil, nil
	}
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
	return convertUserFromStore(user, viewer), nil
}
