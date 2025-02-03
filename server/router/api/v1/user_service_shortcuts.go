package v1

import (
	"context"

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

func (s *APIV1Service) ListShortcuts(ctx context.Context, request *v1pb.ListShortcutsRequest) (*v1pb.ListShortcutsResponse, error) {
	userID, err := ExtractUserIDFromName(request.Parent)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid user name: %v", err)
	}

	currentUser, err := s.GetCurrentUser(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get current user: %v", err)
	}
	if currentUser == nil || currentUser.ID != userID {
		return nil, status.Errorf(codes.PermissionDenied, "permission denied")
	}

	userSetting, err := s.Store.GetUserSetting(ctx, &store.FindUserSetting{
		UserID: &userID,
		Key:    storepb.UserSettingKey_SHORTCUTS,
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
			Id:     shortcut.GetId(),
			Title:  shortcut.GetTitle(),
			Filter: shortcut.GetFilter(),
		})
	}

	return &v1pb.ListShortcutsResponse{
		Shortcuts: shortcuts,
	}, nil
}

func (s *APIV1Service) CreateShortcut(ctx context.Context, request *v1pb.CreateShortcutRequest) (*v1pb.Shortcut, error) {
	userID, err := ExtractUserIDFromName(request.Parent)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid user name: %v", err)
	}

	currentUser, err := s.GetCurrentUser(ctx)
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
			Id:     newShortcut.GetId(),
			Title:  newShortcut.GetTitle(),
			Filter: newShortcut.GetFilter(),
		}, nil
	}

	userSetting, err := s.Store.GetUserSetting(ctx, &store.FindUserSetting{
		UserID: &userID,
		Key:    storepb.UserSettingKey_SHORTCUTS,
	})
	if err != nil {
		return nil, err
	}
	if userSetting == nil {
		userSetting = &storepb.UserSetting{
			UserId: userID,
			Key:    storepb.UserSettingKey_SHORTCUTS,
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
		Id:     request.Shortcut.GetId(),
		Title:  request.Shortcut.GetTitle(),
		Filter: request.Shortcut.GetFilter(),
	}, nil
}

func (s *APIV1Service) UpdateShortcut(ctx context.Context, request *v1pb.UpdateShortcutRequest) (*v1pb.Shortcut, error) {
	userID, err := ExtractUserIDFromName(request.Parent)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid user name: %v", err)
	}

	currentUser, err := s.GetCurrentUser(ctx)
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
		Key:    storepb.UserSettingKey_SHORTCUTS,
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
	for _, shortcut := range shortcuts {
		if shortcut.GetId() == request.Shortcut.GetId() {
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
	shortcutsUserSetting.Shortcuts = newShortcuts
	userSetting.Value = &storepb.UserSetting_Shortcuts{
		Shortcuts: shortcutsUserSetting,
	}
	_, err = s.Store.UpsertUserSetting(ctx, userSetting)
	if err != nil {
		return nil, err
	}

	return &v1pb.Shortcut{
		Id:     request.Shortcut.GetId(),
		Title:  request.Shortcut.GetTitle(),
		Filter: request.Shortcut.GetFilter(),
	}, nil
}

func (s *APIV1Service) DeleteShortcut(ctx context.Context, request *v1pb.DeleteShortcutRequest) (*emptypb.Empty, error) {
	userID, err := ExtractUserIDFromName(request.Parent)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid user name: %v", err)
	}

	currentUser, err := s.GetCurrentUser(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get current user: %v", err)
	}
	if currentUser == nil || currentUser.ID != userID {
		return nil, status.Errorf(codes.PermissionDenied, "permission denied")
	}

	userSetting, err := s.Store.GetUserSetting(ctx, &store.FindUserSetting{
		UserID: &userID,
		Key:    storepb.UserSettingKey_SHORTCUTS,
	})
	if err != nil {
		return nil, err
	}
	if userSetting == nil {
		return &emptypb.Empty{}, nil
	}

	shortcutsUserSetting := userSetting.GetShortcuts()
	shortcuts := shortcutsUserSetting.GetShortcuts()
	newShortcuts := make([]*storepb.ShortcutsUserSetting_Shortcut, 0, len(shortcuts))
	for _, shortcut := range shortcuts {
		if shortcut.GetId() != request.Id {
			newShortcuts = append(newShortcuts, shortcut)
		}
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

func (s *APIV1Service) validateFilter(_ context.Context, filterStr string) error {
	if filterStr == "" {
		return errors.New("filter cannot be empty")
	}
	// Validate the filter.
	parsedExpr, err := filter.Parse(filterStr, filter.MemoFilterCELAttributes...)
	if err != nil {
		return errors.Wrap(err, "failed to parse filter")
	}
	convertCtx := filter.NewConvertContext()
	err = s.Store.GetDriver().ConvertExprToSQL(convertCtx, parsedExpr.GetExpr())
	if err != nil {
		return errors.Wrap(err, "failed to convert filter to SQL")
	}
	return nil
}
