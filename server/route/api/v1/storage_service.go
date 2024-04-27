package v1

import (
	"context"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	v1pb "github.com/usememos/memos/proto/gen/api/v1"
	storepb "github.com/usememos/memos/proto/gen/store"
	"github.com/usememos/memos/store"
)

func (s *APIV1Service) CreateStorage(ctx context.Context, request *v1pb.CreateStorageRequest) (*v1pb.CreateStorageResponse, error) {
	currentUser, err := getCurrentUser(ctx, s.Store)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get user: %v", err)
	}
	if currentUser.Role != store.RoleHost {
		return nil, status.Errorf(codes.PermissionDenied, "permission denied")
	}

	storage, err := s.Store.CreateStorage(ctx, convertStorageToStore(request.Storage))
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to create storage, error: %+v", err)
	}
	return &v1pb.CreateStorageResponse{
		Storage: ConvertStorageFromStore(storage),
	}, nil
}

func (s *APIV1Service) ListStorages(ctx context.Context, _ *v1pb.ListStoragesRequest) (*v1pb.ListStoragesResponse, error) {
	storages, err := s.Store.ListStorages(ctx, &store.FindStorage{})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to list storages, error: %+v", err)
	}

	response := &v1pb.ListStoragesResponse{
		Storages: []*v1pb.Storage{},
	}
	for _, storage := range storages {
		response.Storages = append(response.Storages, ConvertStorageFromStore(storage))
	}
	return response, nil
}

func (s *APIV1Service) GetStorage(ctx context.Context, request *v1pb.GetStorageRequest) (*v1pb.GetStorageResponse, error) {
	storage, err := s.Store.GetStorage(ctx, &store.FindStorage{
		ID: &request.Id,
	})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get storage, error: %+v", err)
	}
	if storage == nil {
		return nil, status.Errorf(codes.NotFound, "storage not found")
	}
	return &v1pb.GetStorageResponse{
		Storage: ConvertStorageFromStore(storage),
	}, nil
}

func (s *APIV1Service) UpdateStorage(ctx context.Context, request *v1pb.UpdateStorageRequest) (*v1pb.UpdateStorageResponse, error) {
	if request.UpdateMask == nil || len(request.UpdateMask.Paths) == 0 {
		return nil, status.Errorf(codes.InvalidArgument, "update_mask is required")
	}

	update := &store.UpdateStorageV1{
		ID:   request.Storage.Id,
		Type: storepb.Storage_Type(storepb.Storage_Type_value[request.Storage.Type.String()]),
	}
	for _, field := range request.UpdateMask.Paths {
		switch field {
		case "name":
			update.Name = &request.Storage.Title
		case "config":
			update.Config = convertStorageConfigToStore(request.Storage.Type, request.Storage.Config)
		}
	}

	storage, err := s.Store.UpdateStorage(ctx, update)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to update storage, error: %+v", err)
	}
	return &v1pb.UpdateStorageResponse{
		Storage: ConvertStorageFromStore(storage),
	}, nil
}

func (s *APIV1Service) DeleteStorage(ctx context.Context, request *v1pb.DeleteStorageRequest) (*v1pb.DeleteStorageResponse, error) {
	err := s.Store.DeleteStorage(ctx, &store.DeleteStorage{
		ID: request.Id,
	})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to delete storage, error: %+v", err)
	}
	return &v1pb.DeleteStorageResponse{}, nil
}

func ConvertStorageFromStore(storage *storepb.Storage) *v1pb.Storage {
	temp := &v1pb.Storage{
		Id:    storage.Id,
		Title: storage.Name,
		Type:  v1pb.Storage_Type(v1pb.Storage_Type_value[storage.Type.String()]),
	}
	if storage.Type == storepb.Storage_S3 {
		s3Config := storage.Config.GetS3Config()
		temp.Config = &v1pb.StorageConfig{
			Config: &v1pb.StorageConfig_S3Config{
				S3Config: &v1pb.S3Config{
					EndPoint:  s3Config.EndPoint,
					Path:      s3Config.Path,
					Region:    s3Config.Region,
					AccessKey: s3Config.AccessKey,
					SecretKey: s3Config.SecretKey,
					Bucket:    s3Config.Bucket,
					UrlPrefix: s3Config.UrlPrefix,
					UrlSuffix: s3Config.UrlSuffix,
					PreSign:   s3Config.PreSign,
				},
			},
		}
	}
	return temp
}

func convertStorageToStore(storage *v1pb.Storage) *storepb.Storage {
	temp := &storepb.Storage{
		Id:     storage.Id,
		Name:   storage.Title,
		Type:   storepb.Storage_Type(storepb.Storage_Type_value[storage.Type.String()]),
		Config: convertStorageConfigToStore(storage.Type, storage.Config),
	}
	return temp
}

func convertStorageConfigToStore(storageType v1pb.Storage_Type, config *v1pb.StorageConfig) *storepb.StorageConfig {
	if storageType == v1pb.Storage_S3 {
		s3Config := config.GetS3Config()
		return &storepb.StorageConfig{
			StorageConfig: &storepb.StorageConfig_S3Config{
				S3Config: &storepb.S3Config{
					EndPoint:  s3Config.EndPoint,
					Path:      s3Config.Path,
					Region:    s3Config.Region,
					AccessKey: s3Config.AccessKey,
					SecretKey: s3Config.SecretKey,
					Bucket:    s3Config.Bucket,
					UrlPrefix: s3Config.UrlPrefix,
					UrlSuffix: s3Config.UrlSuffix,
					PreSign:   s3Config.PreSign,
				},
			},
		}
	}
	return nil
}
