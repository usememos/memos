package v1

import (
	"context"
	"fmt"
	"strings"

	"github.com/pkg/errors"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/emptypb"

	"github.com/usememos/memos/internal/filter"
	"github.com/usememos/memos/internal/util"
	v1pb "github.com/usememos/memos/proto/gen/api/v1"
	storepb "github.com/usememos/memos/proto/gen/store"
	"github.com/usememos/memos/store"
)

// Helper function to extract user and memo view ID from a memo view resource name.
// Format: users/{user}/views/{view}.
func (s *APIV1Service) extractUserAndMemoViewIDFromName(ctx context.Context, name string) (*store.User, string, error) {
	parts := strings.Split(name, "/")
	if len(parts) != 4 || parts[0] != "users" || parts[2] != "views" {
		return nil, "", errors.Errorf("invalid memo view name format: %s", name)
	}

	user, err := ResolveUserByName(ctx, s.Store, BuildUserName(parts[1]))
	if err != nil {
		return nil, "", err
	}
	if user == nil {
		return nil, "", errors.Errorf("user not found: %s", parts[1])
	}

	memoViewID := parts[3]
	if memoViewID == "" {
		return nil, "", errors.Errorf("empty memo view ID in name: %s", name)
	}

	return user, memoViewID, nil
}

// Helper function to construct a memo view resource name.
func constructMemoViewName(username string, memoViewID string) string {
	return fmt.Sprintf("%s/views/%s", BuildUserName(username), memoViewID)
}

func convertMemoViewFromStore(username string, memoView *storepb.MemoViewsUserSetting_MemoView) *v1pb.MemoView {
	return &v1pb.MemoView{
		Name:   constructMemoViewName(username, memoView.GetId()),
		Title:  memoView.GetTitle(),
		Filter: memoView.GetFilter(),
	}
}

// authorizeMemoViewAccess resolves the owner of a memo view collection and asserts that
// the caller is that owner.
func (s *APIV1Service) authorizeMemoViewAccess(ctx context.Context, user *store.User) error {
	currentUser, err := s.fetchCurrentUser(ctx)
	if err != nil {
		return status.Errorf(codes.Internal, "failed to get current user: %v", err)
	}
	if currentUser == nil {
		return status.Errorf(codes.Unauthenticated, "user not authenticated")
	}
	if currentUser.ID != user.ID {
		return status.Errorf(codes.PermissionDenied, "permission denied")
	}
	return nil
}

// ListMemoViews lists the saved memo views owned by a user.
func (s *APIV1Service) ListMemoViews(ctx context.Context, request *v1pb.ListMemoViewsRequest) (*v1pb.ListMemoViewsResponse, error) {
	user, err := ResolveUserByName(ctx, s.Store, request.Parent)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid user name: %v", err)
	}
	if user == nil {
		return nil, status.Errorf(codes.NotFound, "user not found")
	}
	if err := s.authorizeMemoViewAccess(ctx, user); err != nil {
		return nil, err
	}

	storeMemoViews, err := s.Store.GetUserMemoViews(ctx, user.ID)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get memo views: %v", err)
	}

	memoViews := []*v1pb.MemoView{}
	for _, memoView := range storeMemoViews {
		memoViews = append(memoViews, convertMemoViewFromStore(user.Username, memoView))
	}

	return &v1pb.ListMemoViewsResponse{
		MemoViews: memoViews,
	}, nil
}

// GetMemoView returns a saved memo view by resource name.
func (s *APIV1Service) GetMemoView(ctx context.Context, request *v1pb.GetMemoViewRequest) (*v1pb.MemoView, error) {
	user, memoViewID, err := s.extractUserAndMemoViewIDFromName(ctx, request.Name)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid memo view name: %v", err)
	}
	if err := s.authorizeMemoViewAccess(ctx, user); err != nil {
		return nil, err
	}

	memoViews, err := s.Store.GetUserMemoViews(ctx, user.ID)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get memo views: %v", err)
	}
	for _, memoView := range memoViews {
		if memoView.GetId() == memoViewID {
			return convertMemoViewFromStore(user.Username, memoView), nil
		}
	}

	return nil, status.Errorf(codes.NotFound, "memo view not found")
}

// CreateMemoView creates a saved memo view for a user.
func (s *APIV1Service) CreateMemoView(ctx context.Context, request *v1pb.CreateMemoViewRequest) (*v1pb.MemoView, error) {
	user, err := ResolveUserByName(ctx, s.Store, request.Parent)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid user name: %v", err)
	}
	if user == nil {
		return nil, status.Errorf(codes.NotFound, "user not found")
	}
	if err := s.authorizeMemoViewAccess(ctx, user); err != nil {
		return nil, err
	}

	newMemoView := &storepb.MemoViewsUserSetting_MemoView{
		Id:     util.GenUUID(),
		Title:  request.GetMemoView().GetTitle(),
		Filter: request.GetMemoView().GetFilter(),
	}
	if newMemoView.Title == "" {
		return nil, status.Errorf(codes.InvalidArgument, "title is required")
	}
	if err := s.validateFilter(ctx, newMemoView.Filter); err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid filter: %v", err)
	}
	if request.ValidateOnly {
		return convertMemoViewFromStore(user.Username, newMemoView), nil
	}

	if err := s.Store.AddUserMemoView(ctx, user.ID, newMemoView); err != nil {
		return nil, status.Errorf(codes.Internal, "failed to create memo view: %v", err)
	}

	return convertMemoViewFromStore(user.Username, newMemoView), nil
}

// UpdateMemoView updates the selected fields of a saved memo view.
func (s *APIV1Service) UpdateMemoView(ctx context.Context, request *v1pb.UpdateMemoViewRequest) (*v1pb.MemoView, error) {
	user, memoViewID, err := s.extractUserAndMemoViewIDFromName(ctx, request.GetMemoView().GetName())
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid memo view name: %v", err)
	}
	if err := s.authorizeMemoViewAccess(ctx, user); err != nil {
		return nil, err
	}
	if request.UpdateMask == nil || len(request.UpdateMask.Paths) == 0 {
		return nil, status.Errorf(codes.InvalidArgument, "update mask is required")
	}

	var title, filterValue *string
	for _, field := range request.UpdateMask.Paths {
		switch field {
		case "title":
			if request.GetMemoView().GetTitle() == "" {
				return nil, status.Errorf(codes.InvalidArgument, "title is required")
			}
			value := request.GetMemoView().GetTitle()
			title = &value
		case "filter":
			if err := s.validateFilter(ctx, request.GetMemoView().GetFilter()); err != nil {
				return nil, status.Errorf(codes.InvalidArgument, "invalid filter: %v", err)
			}
			value := request.GetMemoView().GetFilter()
			filterValue = &value
		default:
			return nil, status.Errorf(codes.InvalidArgument, "unsupported update mask path: %s", field)
		}
	}

	updatedMemoView, err := s.Store.UpdateUserMemoView(ctx, user.ID, memoViewID, title, filterValue)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to update memo view: %v", err)
	}
	if updatedMemoView == nil {
		return nil, status.Errorf(codes.NotFound, "memo view not found")
	}

	return convertMemoViewFromStore(user.Username, updatedMemoView), nil
}

// DeleteMemoView deletes a saved memo view by resource name.
func (s *APIV1Service) DeleteMemoView(ctx context.Context, request *v1pb.DeleteMemoViewRequest) (*emptypb.Empty, error) {
	user, memoViewID, err := s.extractUserAndMemoViewIDFromName(ctx, request.Name)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid memo view name: %v", err)
	}
	if err := s.authorizeMemoViewAccess(ctx, user); err != nil {
		return nil, err
	}

	found, err := s.Store.RemoveUserMemoView(ctx, user.ID, memoViewID)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to delete memo view: %v", err)
	}
	if !found {
		return nil, status.Errorf(codes.NotFound, "memo view not found")
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

	if _, err := engine.CompileToStatement(ctx, filterStr, filter.RenderOptions{Dialect: s.filterDialect()}); err != nil {
		return errors.Wrap(err, "failed to compile filter")
	}
	return nil
}

// filterDialect maps the configured database driver onto the filter engine dialect.
func (s *APIV1Service) filterDialect() filter.DialectName {
	switch s.Profile.Driver {
	case "mysql":
		return filter.DialectMySQL
	case "postgres":
		return filter.DialectPostgres
	default:
		return filter.DialectSQLite
	}
}
