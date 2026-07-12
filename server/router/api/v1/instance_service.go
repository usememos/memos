package v1

import (
	"context"
	"strings"

	"github.com/pkg/errors"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/emptypb"

	v1pb "github.com/usememos/memos/proto/gen/api/v1"
	storepb "github.com/usememos/memos/proto/gen/store"
	"github.com/usememos/memos/server/notification"
	"github.com/usememos/memos/store"
)

const (
	maxTranscriptionConfigModelLength    = 256
	maxTranscriptionConfigLanguageLength = 32
	maxTranscriptionConfigPromptLength   = 4096
	maxBatchGetInstanceSettings          = 100
)

type instanceSettingCaller struct {
	user   *store.User
	loaded bool
}

func (c *instanceSettingCaller) currentUser(ctx context.Context, service *APIV1Service) (*store.User, error) {
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
func (s *APIV1Service) GetInstanceProfile(ctx context.Context, _ *v1pb.GetInstanceProfileRequest) (*v1pb.InstanceProfile, error) {
	admin, err := s.GetInstanceAdmin(ctx)
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

	instanceProfile := &v1pb.InstanceProfile{
		Version:     s.Profile.Version,
		Demo:        s.Profile.Demo,
		InstanceUrl: s.Profile.InstanceURL,
		Admin:       admin, // for display only; may be nil even on a populated instance
		Commit:      s.Profile.Commit,
		NeedsSetup:  len(users) == 0,
	}
	return instanceProfile, nil
}

func (s *APIV1Service) GetInstanceSetting(ctx context.Context, request *v1pb.GetInstanceSettingRequest) (*v1pb.InstanceSetting, error) {
	return s.getInstanceSettingByName(ctx, request.Name, &instanceSettingCaller{})
}

// BatchGetInstanceSettings returns multiple instance settings in request order.
func (s *APIV1Service) BatchGetInstanceSettings(ctx context.Context, request *v1pb.BatchGetInstanceSettingsRequest) (*v1pb.BatchGetInstanceSettingsResponse, error) {
	if len(request.Names) > maxBatchGetInstanceSettings {
		return nil, status.Errorf(codes.InvalidArgument, "too many instance setting names (max %d)", maxBatchGetInstanceSettings)
	}

	caller := &instanceSettingCaller{}
	settings := make([]*v1pb.InstanceSetting, 0, len(request.Names))
	for _, name := range request.Names {
		setting, err := s.getInstanceSettingByName(ctx, name, caller)
		if err != nil {
			return nil, err
		}
		settings = append(settings, setting)
	}

	return &v1pb.BatchGetInstanceSettingsResponse{Settings: settings}, nil
}

func (s *APIV1Service) getInstanceSettingByName(ctx context.Context, name string, caller *instanceSettingCaller) (*v1pb.InstanceSetting, error) {
	instanceSettingKeyString, err := ExtractInstanceSettingKeyFromName(name)
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

	// Storage and notification settings contain credentials; restrict to admins only.
	if instanceSetting.Key == storepb.InstanceSettingKey_STORAGE ||
		instanceSetting.Key == storepb.InstanceSettingKey_NOTIFICATION {
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

	result := convertInstanceSettingFromStore(instanceSetting)
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
				if existing.Email.SmtpPassword != "" && !sameSMTPConnectionIdentity(notif.Email, existing.Email) {
					return nil, status.Errorf(codes.InvalidArgument, "smtp password is required when changing SMTP host, port, username, or encryption settings")
				}
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

func (s *APIV1Service) TestInstanceEmailSetting(ctx context.Context, request *v1pb.TestInstanceEmailSettingRequest) (*emptypb.Empty, error) {
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

func (s *APIV1Service) resolveTestEmailSetting(ctx context.Context, requestEmail *v1pb.InstanceSetting_NotificationSetting_EmailSetting) (*storepb.InstanceNotificationSetting_EmailSetting, error) {
	if requestEmail == nil {
		existing, err := s.Store.GetInstanceNotificationSetting(ctx)
		if err != nil {
			return nil, status.Errorf(codes.Internal, "failed to get notification setting: %v", err)
		}
		return existing.GetEmail(), nil
	}

	emailSetting := convertInstanceNotificationSettingToStore(&v1pb.InstanceSetting_NotificationSetting{Email: requestEmail}).GetEmail()
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
