package v1

import (
	"context"
	"fmt"
	"log/slog"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/pkg/errors"
	"golang.org/x/crypto/bcrypt"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/emptypb"

	v1pb "github.com/usememos/memos/proto/gen/api/v1"
	storepb "github.com/usememos/memos/proto/gen/store"
	"github.com/usememos/memos/store"
)

const maxBatchGetUsers = 100

func validatePassword(password string) error {
	if password == "" {
		return errors.New("password must not be empty")
	}
	return nil
}

func validateUserTagsSetting(setting *v1pb.UserSetting_TagsSetting) error {
	if setting == nil {
		return errors.New("tags setting is required")
	}
	for tag, metadata := range setting.Tags {
		if strings.TrimSpace(tag) == "" {
			return errors.New("tag key cannot be empty")
		}
		if _, err := regexp.Compile(tag); err != nil {
			return errors.Wrapf(err, "tag key %q is not a valid regex pattern", tag)
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

func (s *APIV1Service) ListUsers(ctx context.Context, request *v1pb.ListUsersRequest) (*v1pb.ListUsersResponse, error) {
	currentUser, err := s.fetchCurrentUser(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get user: %v", err)
	}
	if currentUser == nil {
		return nil, status.Errorf(codes.Unauthenticated, "user not authenticated")
	}
	if currentUser.Role != store.RoleAdmin {
		return nil, status.Errorf(codes.PermissionDenied, "permission denied")
	}

	userFind := &store.FindUser{}

	if request.Filter != "" {
		username, err := extractUsernameFromFilter(request.Filter)
		if err != nil {
			return nil, status.Errorf(codes.InvalidArgument, "invalid filter: %v", err)
		}
		if username != "" {
			userFind.Username = &username
		}
	}

	users, err := s.Store.ListUsers(ctx, userFind)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to list users: %v", err)
	}

	// TODO: Implement proper ordering, and pagination
	// For now, return all users with basic structure
	response := &v1pb.ListUsersResponse{
		Users:     []*v1pb.User{},
		TotalSize: int32(len(users)),
	}
	for _, user := range users {
		response.Users = append(response.Users, convertUserFromStore(user, currentUser))
	}
	return response, nil
}

func normalizeBatchUsernames(usernames []string) ([]string, int) {
	uniqueUsernames := make([]string, 0, len(usernames))
	seen := make(map[string]struct{}, len(usernames))
	nonEmptyCount := 0
	for _, username := range usernames {
		username = strings.TrimSpace(username)
		if username == "" {
			continue
		}
		nonEmptyCount++
		if _, ok := seen[username]; ok {
			continue
		}
		seen[username] = struct{}{}
		uniqueUsernames = append(uniqueUsernames, username)
	}
	return uniqueUsernames, nonEmptyCount
}

func (s *APIV1Service) BatchGetUsers(ctx context.Context, request *v1pb.BatchGetUsersRequest) (*v1pb.BatchGetUsersResponse, error) {
	if len(request.Usernames) == 0 {
		return &v1pb.BatchGetUsersResponse{Users: []*v1pb.User{}}, nil
	}

	uniqueUsernames, nonEmptyUsernameCount := normalizeBatchUsernames(request.Usernames)
	if nonEmptyUsernameCount > maxBatchGetUsers {
		return nil, status.Errorf(codes.InvalidArgument, "too many usernames (max %d)", maxBatchGetUsers)
	}

	if len(uniqueUsernames) == 0 {
		return &v1pb.BatchGetUsersResponse{Users: []*v1pb.User{}}, nil
	}

	normal := store.Normal
	users, err := s.Store.ListUsers(ctx, &store.FindUser{
		UsernameList: uniqueUsernames,
		RowStatus:    &normal,
	})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to list users: %v", err)
	}

	currentUser, _ := s.fetchCurrentUser(ctx)
	response := &v1pb.BatchGetUsersResponse{
		Users: make([]*v1pb.User, 0, len(users)),
	}
	for _, user := range users {
		response.Users = append(response.Users, convertUserFromStore(user, currentUser))
	}
	return response, nil
}

func (s *APIV1Service) GetUser(ctx context.Context, request *v1pb.GetUserRequest) (*v1pb.User, error) {
	user, err := ResolveUserByName(ctx, s.Store, request.Name)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid user name: %s", request.Name)
	}
	if user == nil {
		return nil, status.Errorf(codes.NotFound, "user not found")
	}
	currentUser, _ := s.fetchCurrentUser(ctx)
	return convertUserFromStore(user, currentUser), nil
}

func (s *APIV1Service) CreateUser(ctx context.Context, request *v1pb.CreateUserRequest) (*v1pb.User, error) {
	// Get current user (might be nil for unauthenticated requests)
	currentUser, _ := s.fetchCurrentUser(ctx)

	if request.User == nil {
		return nil, status.Errorf(codes.InvalidArgument, "user is required")
	}
	if err := validateWritableUsername(request.User.Username); err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid username: %s", request.User.Username)
	}
	if err := validatePassword(request.User.Password); err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "%v", err)
	}

	roleToAssign := store.RoleUser
	if currentUser != nil && currentUser.Role == store.RoleAdmin {
		// Authenticated ADMIN user can create users with any role specified in request
		if request.User.Role != v1pb.User_ROLE_UNSPECIFIED {
			roleToAssign = convertUserRoleToStore(request.User.Role)
		}
	} else {
		limitOne := 1
		allUsers, err := s.Store.ListUsers(ctx, &store.FindUser{Limit: &limitOne})
		if err != nil {
			return nil, status.Errorf(codes.Internal, "failed to list users: %v", err)
		}
		if len(allUsers) == 0 {
			roleToAssign = store.RoleAdmin
			if !request.ValidateOnly {
				passwordHash, err := bcrypt.GenerateFromPassword([]byte(request.User.Password), bcrypt.DefaultCost)
				if err != nil {
					return nil, status.Errorf(codes.Internal, "failed to generate password hash: %v", err)
				}
				user, created, err := s.Store.CreateUserIfNoUsers(ctx, &store.User{
					Username:     request.User.Username,
					Role:         store.RoleAdmin,
					Email:        request.User.Email,
					Nickname:     request.User.DisplayName,
					PasswordHash: string(passwordHash),
				})
				if err != nil {
					return nil, status.Errorf(codes.Internal, "failed to create first user: %v", err)
				}
				if created {
					return convertUserFromStore(user, user), nil
				}
				roleToAssign = store.RoleUser
			}
		}

		// Only allow user registration if it is enabled in the settings, or if the user is a superuser
		if roleToAssign != store.RoleAdmin {
			instanceGeneralSetting, err := s.Store.GetInstanceGeneralSetting(ctx)
			if err != nil {
				return nil, status.Errorf(codes.Internal, "failed to get instance general setting, error: %v", err)
			}
			if instanceGeneralSetting.DisallowUserRegistration {
				return nil, status.Errorf(codes.PermissionDenied, "user registration is not allowed")
			}
			if instanceGeneralSetting.DisallowPasswordAuth {
				return nil, status.Errorf(codes.PermissionDenied, "password signup is not allowed")
			}
		}
	}

	// If validate_only is true, just validate without creating
	if request.ValidateOnly {
		// Perform validation checks without actually creating the user
		return &v1pb.User{
			Username:    request.User.Username,
			Email:       request.User.Email,
			DisplayName: request.User.DisplayName,
			Role:        convertUserRoleFromStore(roleToAssign),
		}, nil
	}

	passwordHash, err := bcrypt.GenerateFromPassword([]byte(request.User.Password), bcrypt.DefaultCost)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to generate password hash: %v", err)
	}

	user, err := s.Store.CreateUser(ctx, &store.User{
		Username:     request.User.Username,
		Role:         roleToAssign,
		Email:        request.User.Email,
		Nickname:     request.User.DisplayName,
		PasswordHash: string(passwordHash),
	})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to create user: %v", err)
	}

	return convertUserFromStore(user, user), nil
}

func (s *APIV1Service) UpdateUser(ctx context.Context, request *v1pb.UpdateUserRequest) (*v1pb.User, error) {
	if request.User == nil {
		return nil, status.Errorf(codes.InvalidArgument, "user is required")
	}
	if request.UpdateMask == nil || len(request.UpdateMask.Paths) == 0 {
		return nil, status.Errorf(codes.InvalidArgument, "update mask is empty")
	}
	user, err := ResolveUserByName(ctx, s.Store, request.User.Name)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid user name: %v", err)
	}
	if user == nil {
		if request.AllowMissing {
			return nil, status.Errorf(codes.NotFound, "user not found")
		}
		return nil, status.Errorf(codes.NotFound, "user not found")
	}
	userID := user.ID
	currentUser, err := s.fetchCurrentUser(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get user: %v", err)
	}
	if currentUser == nil {
		return nil, status.Errorf(codes.Unauthenticated, "user not authenticated")
	}
	// Check permission.
	// Only allow admin or self to update user.
	if currentUser.ID != userID && currentUser.Role != store.RoleAdmin {
		return nil, status.Errorf(codes.PermissionDenied, "permission denied")
	}

	currentTs := time.Now().Unix()
	update := &store.UpdateUser{
		ID:        user.ID,
		UpdatedTs: &currentTs,
	}
	instanceGeneralSetting, err := s.Store.GetInstanceGeneralSetting(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get instance general setting: %v", err)
	}
	for _, field := range request.UpdateMask.Paths {
		switch field {
		case "username":
			if instanceGeneralSetting.DisallowChangeUsername {
				return nil, status.Errorf(codes.PermissionDenied, "permission denied: disallow change username")
			}
			if err := validateWritableUsername(request.User.Username); err != nil {
				return nil, status.Errorf(codes.InvalidArgument, "invalid username: %s", request.User.Username)
			}
			update.Username = &request.User.Username
		case "display_name":
			if instanceGeneralSetting.DisallowChangeNickname {
				return nil, status.Errorf(codes.PermissionDenied, "permission denied: disallow change nickname")
			}
			update.Nickname = &request.User.DisplayName
		case "email":
			update.Email = &request.User.Email
		case "avatar_url":
			// Validate avatar MIME type to prevent XSS during upload
			if request.User.AvatarUrl != "" {
				imageType, _, err := extractImageInfo(request.User.AvatarUrl)
				if err != nil {
					return nil, status.Errorf(codes.InvalidArgument, "invalid avatar format: %v", err)
				}
				// Only allow safe image formats for avatars
				allowedAvatarTypes := map[string]bool{
					"image/png":  true,
					"image/jpeg": true,
					"image/jpg":  true,
					"image/gif":  true,
					"image/webp": true,
				}
				if !allowedAvatarTypes[imageType] {
					return nil, status.Errorf(codes.InvalidArgument, "invalid avatar image type: %s. Only PNG, JPEG, GIF, and WebP are allowed", imageType)
				}
			}
			update.AvatarURL = &request.User.AvatarUrl
		case "description":
			update.Description = &request.User.Description
		case "role":
			// Only allow admin to update role.
			if currentUser.Role != store.RoleAdmin {
				return nil, status.Errorf(codes.PermissionDenied, "permission denied")
			}
			role := convertUserRoleToStore(request.User.Role)
			update.Role = &role
		case "password":
			if err := validatePassword(request.User.Password); err != nil {
				return nil, status.Errorf(codes.InvalidArgument, "%v", err)
			}
			passwordHash, err := bcrypt.GenerateFromPassword([]byte(request.User.Password), bcrypt.DefaultCost)
			if err != nil {
				return nil, status.Errorf(codes.Internal, "failed to generate password hash: %v", err)
			}
			passwordHashStr := string(passwordHash)
			update.PasswordHash = &passwordHashStr
		case "state":
			if currentUser.Role != store.RoleAdmin {
				return nil, status.Errorf(codes.PermissionDenied, "permission denied")
			}
			rowStatus := convertStateToStore(request.User.State)
			update.RowStatus = &rowStatus
		default:
			return nil, status.Errorf(codes.InvalidArgument, "invalid update path: %s", field)
		}
	}

	updatedUser, err := s.Store.UpdateUser(ctx, update)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to update user: %v", err)
	}

	return convertUserFromStore(updatedUser, currentUser), nil
}

func (s *APIV1Service) DeleteUser(ctx context.Context, request *v1pb.DeleteUserRequest) (*emptypb.Empty, error) {
	user, err := ResolveUserByName(ctx, s.Store, request.Name)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid user name: %v", err)
	}
	if user == nil {
		return nil, status.Errorf(codes.NotFound, "user not found")
	}
	userID := user.ID
	currentUser, err := s.fetchCurrentUser(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get user: %v", err)
	}
	if currentUser == nil {
		return nil, status.Errorf(codes.Unauthenticated, "user not authenticated")
	}
	if currentUser.ID != userID && currentUser.Role != store.RoleAdmin {
		return nil, status.Errorf(codes.PermissionDenied, "permission denied")
	}
	isSelfDelete := currentUser.ID == userID

	deleteResult, err := s.Store.DeleteUser(ctx, &store.DeleteUser{
		ID: user.ID,
	})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to delete user: %v", err)
	}
	attachments := deleteResult.Attachments
	var attachmentCleanupErr error
	failedAttachmentIDs := make([]int32, 0)
	attachmentStorageSetting, attachmentStorageSettingErr := getDeleteUserAttachmentStorageSetting(ctx, s.Store, attachments)
	for _, attachment := range attachments {
		var err error
		if attachmentStorageSettingErr != nil && store.AttachmentNeedsInstanceStorageSetting(attachment) {
			err = attachmentStorageSettingErr
		} else {
			err = s.Store.DeleteAttachmentStorageWithInstanceSetting(ctx, attachment, attachmentStorageSetting)
		}
		if err != nil {
			slog.Warn("failed to delete attachment storage after deleting user", "user_id", userID, "attachment_id", attachment.ID, "error", err)
			failedAttachmentIDs = append(failedAttachmentIDs, attachment.ID)
			if attachmentCleanupErr == nil {
				attachmentCleanupErr = err
			}
		}
	}
	if isSelfDelete {
		if err := s.clearAuthCookies(ctx); err != nil {
			slog.Warn("failed to clear auth cookies after self delete", "user_id", userID, "error", err)
		}
	}
	if attachmentCleanupErr != nil {
		return nil, status.Errorf(
			codes.Internal,
			"user was deleted but attachment storage cleanup failed for %d attachment(s), first attachment_id=%d: %v",
			len(failedAttachmentIDs),
			failedAttachmentIDs[0],
			attachmentCleanupErr,
		)
	}

	return &emptypb.Empty{}, nil
}

func getDeleteUserAttachmentStorageSetting(ctx context.Context, stores *store.Store, attachments []*store.Attachment) (*storepb.InstanceStorageSetting, error) {
	for _, attachment := range attachments {
		if store.AttachmentNeedsInstanceStorageSetting(attachment) {
			instanceStorageSetting, err := stores.GetInstanceStorageSetting(ctx)
			if err != nil {
				return nil, errors.Wrap(err, "failed to get instance storage setting")
			}
			return instanceStorageSetting, nil
		}
	}
	return nil, nil
}

func getDefaultUserGeneralSetting() *v1pb.UserSetting_GeneralSetting {
	return &v1pb.UserSetting_GeneralSetting{
		Locale:         "en",
		MemoVisibility: "PRIVATE",
		Theme:          "",
	}
}

func (s *APIV1Service) resolveUserFromName(ctx context.Context, name string) (*store.User, error) {
	user, err := ResolveUserByName(ctx, s.Store, name)
	if err != nil {
		return nil, err
	}
	if user == nil {
		return nil, errors.Errorf("user not found: %s", name)
	}
	return user, nil
}

func (s *APIV1Service) resolveUserAndSettingKeyFromName(ctx context.Context, name string) (*store.User, string, error) {
	parts := strings.Split(name, "/")
	if len(parts) != 4 || parts[0] != "users" || parts[2] != "settings" {
		return nil, "", errors.Errorf("invalid resource name format: %s", name)
	}

	user, err := s.resolveUserFromName(ctx, BuildUserName(parts[1]))
	if err != nil {
		return nil, "", err
	}
	return user, parts[3], nil
}

func (s *APIV1Service) resolveUserAndWebhookIDFromName(ctx context.Context, name string) (*store.User, string, error) {
	parts := strings.Split(name, "/")
	if len(parts) != 4 || parts[0] != "users" || parts[2] != "webhooks" {
		return nil, "", errors.New("invalid webhook name format")
	}

	user, err := s.resolveUserFromName(ctx, BuildUserName(parts[1]))
	if err != nil {
		return nil, "", err
	}
	return user, parts[3], nil
}

func (s *APIV1Service) resolveUserAndLinkedIdentityProviderFromName(ctx context.Context, name string) (*store.User, string, error) {
	parts := strings.Split(name, "/")
	if len(parts) != 4 || parts[0] != "users" || parts[2] != "linkedIdentities" {
		return nil, "", errors.Errorf("invalid linked identity name: %s", name)
	}

	user, err := s.resolveUserFromName(ctx, BuildUserName(parts[1]))
	if err != nil {
		return nil, "", err
	}
	return user, parts[3], nil
}

func convertLinkedIdentityFromStore(user *store.User, identity *store.UserIdentity) *v1pb.LinkedIdentity {
	return &v1pb.LinkedIdentity{
		Name:      fmt.Sprintf("%s/linkedIdentities/%s", BuildUserName(user.Username), identity.Provider),
		IdpName:   IdentityProviderNamePrefix + identity.Provider,
		ExternUid: identity.ExternUID,
	}
}

func (s *APIV1Service) resolveUserAndNotificationIDFromName(ctx context.Context, name string) (*store.User, int32, error) {
	parts := strings.Split(name, "/")
	if len(parts) != 4 || parts[0] != "users" || parts[2] != "notifications" {
		return nil, 0, errors.Errorf("invalid notification name: %s", name)
	}

	user, err := s.resolveUserFromName(ctx, BuildUserName(parts[1]))
	if err != nil {
		return nil, 0, err
	}

	id, err := strconv.Atoi(parts[3])
	if err != nil {
		return nil, 0, errors.Errorf("invalid notification id: %s", parts[3])
	}

	return user, int32(id), nil
}
