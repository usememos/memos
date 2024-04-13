package v2

import (
	"context"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	apiv2pb "github.com/usememos/memos/proto/gen/api/v2"
	storepb "github.com/usememos/memos/proto/gen/store"
	"github.com/usememos/memos/store"
)

func (s *APIV2Service) CreateStorage(ctx context.Context, request *apiv2pb.CreateStorageRequest) (*apiv2pb.CreateStorageResponse, error) {
	currentUser, err := getCurrentUser(ctx, s.Store)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get user: %v", err)
	}
	if currentUser.Role != store.RoleHost {
		return nil, status.Errorf(codes.PermissionDenied, "permission denied")
	}

	storage, err := s.Store.CreateStorageV1(ctx, convertStorageToStore(request.Storage))
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to create storage, error: %+v", err)
	}
	return &apiv2pb.CreateStorageResponse{
		Storage: convertStorageFromStore(storage),
	}, nil
}

func (s *APIV2Service) ListStorages(ctx context.Context, _ *apiv2pb.ListStoragesRequest) (*apiv2pb.ListStoragesResponse, error) {
	storages, err := s.Store.ListStoragesV1(ctx, &store.FindStorage{})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to list storages, error: %+v", err)
	}

	response := &apiv2pb.ListStoragesResponse{
		Storages: []*apiv2pb.Storage{},
	}
	for _, storage := range storages {
		response.Storages = append(response.Storages, convertStorageFromStore(storage))
	}
	return response, nil
}

func (s *APIV2Service) GetStorage(ctx context.Context, request *apiv2pb.GetStorageRequest) (*apiv2pb.GetStorageResponse, error) {
	storage, err := s.Store.GetStorageV1(ctx, &store.FindStorage{
		ID: &request.Id,
	})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get storage, error: %+v", err)
	}
	if storage == nil {
		return nil, status.Errorf(codes.NotFound, "storage not found")
	}
	return &apiv2pb.GetStorageResponse{
		Storage: convertStorageFromStore(storage),
	}, nil
}

func (s *APIV2Service) UpdateStorage(ctx context.Context, request *apiv2pb.UpdateStorageRequest) (*apiv2pb.UpdateStorageResponse, error) {
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

	storage, err := s.Store.UpdateStorageV1(ctx, update)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to update storage, error: %+v", err)
	}
	return &apiv2pb.UpdateStorageResponse{
		Storage: convertStorageFromStore(storage),
	}, nil
}

func (s *APIV2Service) DeleteStorage(ctx context.Context, request *apiv2pb.DeleteStorageRequest) (*apiv2pb.DeleteStorageResponse, error) {
	err := s.Store.DeleteStorage(ctx, &store.DeleteStorage{
		ID: request.Id,
	})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to delete storage, error: %+v", err)
	}
	return &apiv2pb.DeleteStorageResponse{}, nil
}

func convertStorageFromStore(storage *storepb.Storage) *apiv2pb.Storage {
	temp := &apiv2pb.Storage{
		Id:    storage.Id,
		Title: storage.Name,
		Type:  apiv2pb.Storage_Type(apiv2pb.Storage_Type_value[storage.Type.String()]),
	}
	if storage.Type == storepb.Storage_S3 {
		s3Config := storage.Config.GetS3Config()
		temp.Config = &apiv2pb.StorageConfig{
			Config: &apiv2pb.StorageConfig_S3Config{
				S3Config: &apiv2pb.S3Config{
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

func convertStorageToStore(storage *apiv2pb.Storage) *storepb.Storage {
	temp := &storepb.Storage{
		Id:     storage.Id,
		Name:   storage.Title,
		Type:   storepb.Storage_Type(storepb.Storage_Type_value[storage.Type.String()]),
		Config: convertStorageConfigToStore(storage.Type, storage.Config),
	}
	return temp
}

func convertStorageConfigToStore(storageType apiv2pb.Storage_Type, config *apiv2pb.StorageConfig) *storepb.StorageConfig {
	if storageType == apiv2pb.Storage_S3 {
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
