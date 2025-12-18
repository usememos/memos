package v1

import (
	"context"
	"fmt"
	"strings"

	"github.com/pkg/errors"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/emptypb"

	"github.com/usememos/memos/internal/util"
	"github.com/usememos/memos/plugin/filter"
	v1pb "github.com/usememos/memos/proto/gen/api/v1"
	storepb "github.com/usememos/memos/proto/gen/store"
	"github.com/usememos/memos/store"
)

// Helper function to extract user ID and shortcut ID from shortcut resource name.
// Format: users/{user}/shortcuts/{shortcut}.
func extractUserAndShortcutIDFromName(name string) (int32, string, error) {
	parts := strings.Split(name, "/")
	if len(parts) != 4 || parts[0] != "users" || parts[2] != "shortcuts" {
		return 0, "", errors.Errorf("invalid shortcut name format: %s", name)
	}

	userID, err := util.ConvertStringToInt32(parts[1])
	if err != nil {
		return 0, "", errors.Errorf("invalid user ID %q", parts[1])
	}

	shortcutID := parts[3]
	if shortcutID == "" {
		return 0, "", errors.Errorf("empty shortcut ID in name: %s", name)
	}

	return userID, shortcutID, nil
}

// Helper function to construct shortcut resource name.
func constructShortcutName(userID int32, shortcutID string) string {
	return fmt.Sprintf("users/%d/shortcuts/%s", userID, shortcutID)
}

func (s *APIV1Service) ListShortcuts(ctx context.Context, request *v1pb.ListShortcutsRequest) (*v1pb.ListShortcutsResponse, error) {
	userID, err := ExtractUserIDFromName(request.Parent)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid user name: %v", err)
	}

	currentUser, err := s.fetchCurrentUser(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get current user: %v", err)
	}
	if currentUser == nil || currentUser.ID != userID {
		return nil, status.Errorf(codes.PermissionDenied, "permission denied")
	}

	userSetting, err := s.Store.GetUserSetting(ctx, &store.FindUserSetting{
		UserID: &userID,
		Key:    storepb.UserSetting_SHORTCUTS,
	})
	if err != nil {
		return nil, err
	}
	if userSetting == nil {
		return &v1pb.ListShortcutsResponse{
			Shortcuts: []*v1pb.Shortcut{},
		}, nil
	}

	shortcutsUserSetting := userSetting.GetShortcuts()
	shortcuts := []*v1pb.Shortcut{}
	for _, shortcut := range shortcutsUserSetting.GetShortcuts() {
		shortcuts = append(shortcuts, &v1pb.Shortcut{
			Name:   constructShortcutName(userID, shortcut.GetId()),
			Title:  shortcut.GetTitle(),
			Filter: shortcut.GetFilter(),
		})
	}

	return &v1pb.ListShortcutsResponse{
		Shortcuts: shortcuts,
	}, nil
}

func (s *APIV1Service) GetShortcut(ctx context.Context, request *v1pb.GetShortcutRequest) (*v1pb.Shortcut, error) {
	userID, shortcutID, err := extractUserAndShortcutIDFromName(request.Name)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid shortcut name: %v", err)
	}

	currentUser, err := s.fetchCurrentUser(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get current user: %v", err)
	}
	if currentUser == nil || currentUser.ID != userID {
		return nil, status.Errorf(codes.PermissionDenied, "permission denied")
	}

	userSetting, err := s.Store.GetUserSetting(ctx, &store.FindUserSetting{
		UserID: &userID,
		Key:    storepb.UserSetting_SHORTCUTS,
	})
	if err != nil {
		return nil, err
	}
	if userSetting == nil {
		return nil, status.Errorf(codes.NotFound, "shortcut not found")
	}

	shortcutsUserSetting := userSetting.GetShortcuts()
	for _, shortcut := range shortcutsUserSetting.GetShortcuts() {
		if shortcut.GetId() == shortcutID {
			return &v1pb.Shortcut{
				Name:   constructShortcutName(userID, shortcut.GetId()),
				Title:  shortcut.GetTitle(),
				Filter: shortcut.GetFilter(),
			}, nil
		}
	}

	return nil, status.Errorf(codes.NotFound, "shortcut not found")
}

func (s *APIV1Service) CreateShortcut(ctx context.Context, request *v1pb.CreateShortcutRequest) (*v1pb.Shortcut, error) {
	userID, err := ExtractUserIDFromName(request.Parent)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid user name: %v", err)
	}

	currentUser, err := s.fetchCurrentUser(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get current user: %v", err)
	}
	if currentUser == nil || currentUser.ID != userID {
		return nil, status.Errorf(codes.PermissionDenied, "permission denied")
	}

	newShortcut := &storepb.ShortcutsUserSetting_Shortcut{
		Id:     util.GenUUID(),
		Title:  request.Shortcut.GetTitle(),
		Filter: request.Shortcut.GetFilter(),
	}
	if newShortcut.Title == "" {
		return nil, status.Errorf(codes.InvalidArgument, "title is required")
	}
	if err := s.validateFilter(ctx, newShortcut.Filter); err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid filter: %v", err)
	}
	if request.ValidateOnly {
		return &v1pb.Shortcut{
			Name:   constructShortcutName(userID, newShortcut.GetId()),
			Title:  newShortcut.GetTitle(),
			Filter: newShortcut.GetFilter(),
		}, nil
	}

	userSetting, err := s.Store.GetUserSetting(ctx, &store.FindUserSetting{
		UserID: &userID,
		Key:    storepb.UserSetting_SHORTCUTS,
	})
	if err != nil {
		return nil, err
	}
	if userSetting == nil {
		userSetting = &storepb.UserSetting{
			UserId: userID,
			Key:    storepb.UserSetting_SHORTCUTS,
			Value: &storepb.UserSetting_Shortcuts{
				Shortcuts: &storepb.ShortcutsUserSetting{
					Shortcuts: []*storepb.ShortcutsUserSetting_Shortcut{},
				},
			},
		}
	}
	shortcutsUserSetting := userSetting.GetShortcuts()
	shortcuts := shortcutsUserSetting.GetShortcuts()
	shortcuts = append(shortcuts, newShortcut)
	shortcutsUserSetting.Shortcuts = shortcuts

	userSetting.Value = &storepb.UserSetting_Shortcuts{
		Shortcuts: shortcutsUserSetting,
	}

	_, err = s.Store.UpsertUserSetting(ctx, userSetting)
	if err != nil {
		return nil, err
	}

	return &v1pb.Shortcut{
		Name:   constructShortcutName(userID, newShortcut.GetId()),
		Title:  newShortcut.GetTitle(),
		Filter: newShortcut.GetFilter(),
	}, nil
}

func (s *APIV1Service) UpdateShortcut(ctx context.Context, request *v1pb.UpdateShortcutRequest) (*v1pb.Shortcut, error) {
	userID, shortcutID, err := extractUserAndShortcutIDFromName(request.Shortcut.Name)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid shortcut name: %v", err)
	}

	currentUser, err := s.fetchCurrentUser(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get current user: %v", err)
	}
	if currentUser == nil || currentUser.ID != userID {
		return nil, status.Errorf(codes.PermissionDenied, "permission denied")
	}
	if request.UpdateMask == nil || len(request.UpdateMask.Paths) == 0 {
		return nil, status.Errorf(codes.InvalidArgument, "update mask is required")
	}

	userSetting, err := s.Store.GetUserSetting(ctx, &store.FindUserSetting{
		UserID: &userID,
		Key:    storepb.UserSetting_SHORTCUTS,
	})
	if err != nil {
		return nil, err
	}
	if userSetting == nil {
		return nil, status.Errorf(codes.NotFound, "shortcut not found")
	}

	shortcutsUserSetting := userSetting.GetShortcuts()
	shortcuts := shortcutsUserSetting.GetShortcuts()
	var foundShortcut *storepb.ShortcutsUserSetting_Shortcut
	newShortcuts := make([]*storepb.ShortcutsUserSetting_Shortcut, 0, len(shortcuts))
	for _, shortcut := range shortcuts {
		if shortcut.GetId() == shortcutID {
			foundShortcut = shortcut
			for _, field := range request.UpdateMask.Paths {
				if field == "title" {
					if request.Shortcut.GetTitle() == "" {
						return nil, status.Errorf(codes.InvalidArgument, "title is required")
					}
					shortcut.Title = request.Shortcut.GetTitle()
				} else if field == "filter" {
					if err := s.validateFilter(ctx, request.Shortcut.GetFilter()); err != nil {
						return nil, status.Errorf(codes.InvalidArgument, "invalid filter: %v", err)
					}
					shortcut.Filter = request.Shortcut.GetFilter()
				}
			}
		}
		newShortcuts = append(newShortcuts, shortcut)
	}

	if foundShortcut == nil {
		return nil, status.Errorf(codes.NotFound, "shortcut not found")
	}

	shortcutsUserSetting.Shortcuts = newShortcuts
	userSetting.Value = &storepb.UserSetting_Shortcuts{
		Shortcuts: shortcutsUserSetting,
	}
	_, err = s.Store.UpsertUserSetting(ctx, userSetting)
	if err != nil {
		return nil, err
	}

	return &v1pb.Shortcut{
		Name:   constructShortcutName(userID, foundShortcut.GetId()),
		Title:  foundShortcut.GetTitle(),
		Filter: foundShortcut.GetFilter(),
	}, nil
}

func (s *APIV1Service) DeleteShortcut(ctx context.Context, request *v1pb.DeleteShortcutRequest) (*emptypb.Empty, error) {
	userID, shortcutID, err := extractUserAndShortcutIDFromName(request.Name)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid shortcut name: %v", err)
	}

	currentUser, err := s.fetchCurrentUser(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get current user: %v", err)
	}
	if currentUser == nil || currentUser.ID != userID {
		return nil, status.Errorf(codes.PermissionDenied, "permission denied")
	}

	userSetting, err := s.Store.GetUserSetting(ctx, &store.FindUserSetting{
		UserID: &userID,
		Key:    storepb.UserSetting_SHORTCUTS,
	})
	if err != nil {
		return nil, err
	}
	if userSetting == nil {
		return nil, status.Errorf(codes.NotFound, "shortcut not found")
	}

	shortcutsUserSetting := userSetting.GetShortcuts()
	shortcuts := shortcutsUserSetting.GetShortcuts()
	newShortcuts := make([]*storepb.ShortcutsUserSetting_Shortcut, 0, len(shortcuts))
	found := false
	for _, shortcut := range shortcuts {
		if shortcut.GetId() != shortcutID {
			newShortcuts = append(newShortcuts, shortcut)
		} else {
			found = true
		}
	}
	if !found {
		return nil, status.Errorf(codes.NotFound, "shortcut not found")
	}
	shortcutsUserSetting.Shortcuts = newShortcuts
	userSetting.Value = &storepb.UserSetting_Shortcuts{
		Shortcuts: shortcutsUserSetting,
	}
	_, err = s.Store.UpsertUserSetting(ctx, userSetting)
	if err != nil {
		return nil, err
	}

	return &emptypb.Empty{}, nil
}

func (s *APIV1Service) validateFilter(ctx context.Context, filterStr string) error {
	if filterStr == "" {
		return errors.New("filter cannot be empty")
	}

	engine, err := filter.DefaultEngine()
	if err != nil {
		return err
	}

	var dialect filter.DialectName
	switch s.Profile.Driver {
	case "mysql":
		dialect = filter.DialectMySQL
	case "postgres":
		dialect = filter.DialectPostgres
	default:
		dialect = filter.DialectSQLite
	}

	if _, err := engine.CompileToStatement(ctx, filterStr, filter.RenderOptions{Dialect: dialect}); err != nil {
		return errors.Wrap(err, "failed to compile filter")
	}
	return nil
}
