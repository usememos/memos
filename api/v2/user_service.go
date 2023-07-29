package v2

import (
	"context"

	apiv2pb "github.com/usememos/memos/proto/gen/api/v2"
	"github.com/usememos/memos/store"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

type UserService struct {
	apiv2pb.UnimplementedUserServiceServer

	Store *store.Store
}

// NewUserService creates a new UserService.
func NewUserService(store *store.Store) *UserService {
	return &UserService{
		Store: store,
	}
}

func (s *UserService) GetUser(ctx context.Context, request *apiv2pb.GetUserRequest) (*apiv2pb.GetUserResponse, error) {
	println("GetUser", request.Name)
	user, err := s.Store.GetUser(ctx, &store.FindUser{
		Username: &request.Name,
	})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to list tags: %v", err)
	}
	if user == nil {
		return nil, status.Errorf(codes.NotFound, "user not found")
	}

	userMessage := convertUserFromStore(user)
	// Data desensitization.
	userMessage.OpenId = ""

	response := &apiv2pb.GetUserResponse{
		User: userMessage,
	}
	return response, nil
}

func convertUserFromStore(user *store.User) *apiv2pb.User {
	return &apiv2pb.User{
		Id:        int32(user.ID),
		RowStatus: convertRowStatusFromStore(user.RowStatus),
		CreatedTs: user.CreatedTs,
		UpdatedTs: user.UpdatedTs,
		Username:  user.Username,
		Role:      convertUserRoleFromStore(user.Role),
		Email:     user.Email,
		Nickname:  user.Nickname,
		OpenId:    user.OpenID,
		AvatarUrl: user.AvatarURL,
	}
}

func convertUserRoleFromStore(role store.Role) apiv2pb.Role {
	switch role {
	case store.RoleHost:
		return apiv2pb.Role_HOST
	case store.RoleAdmin:
		return apiv2pb.Role_ADMIN
	case store.RoleUser:
		return apiv2pb.Role_USER
	default:
		return apiv2pb.Role_ROLE_UNSPECIFIED
	}
}
