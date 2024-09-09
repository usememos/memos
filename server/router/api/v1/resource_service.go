package v1

import (
	"bytes"
	"context"
	"encoding/binary"
	"fmt"
	"io"
	"log/slog"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"time"

	"github.com/disintegration/imaging"
	"github.com/lithammer/shortuuid/v4"
	"github.com/pkg/errors"
	"google.golang.org/genproto/googleapis/api/httpbody"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/emptypb"
	"google.golang.org/protobuf/types/known/timestamppb"

	"github.com/usememos/memos/internal/util"
	"github.com/usememos/memos/plugin/storage/s3"
	v1pb "github.com/usememos/memos/proto/gen/api/v1"
	storepb "github.com/usememos/memos/proto/gen/store"
	"github.com/usememos/memos/store"
)

const (
	// The upload memory buffer is 32 MiB.
	// It should be kept low, so RAM usage doesn't get out of control.
	// This is unrelated to maximum upload size limit, which is now set through system setting.
	MaxUploadBufferSizeBytes = 32 << 20
	MebiByte                 = 1024 * 1024
	// ThumbnailCacheFolder is the folder name where the thumbnail images are stored.
	ThumbnailCacheFolder = ".thumbnail_cache"
)

var SupportedThumbnailMimeTypes = []string{
	"image/png",
	"image/jpeg",
}

func (s *APIV1Service) CreateResource(ctx context.Context, request *v1pb.CreateResourceRequest) (*v1pb.Resource, error) {
	user, err := s.GetCurrentUser(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get current user: %v", err)
	}

	create := &store.Resource{
		UID:       shortuuid.New(),
		CreatorID: user.ID,
		Filename:  request.Resource.Filename,
		Type:      request.Resource.Type,
	}

	workspaceStorageSetting, err := s.Store.GetWorkspaceStorageSetting(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get workspace storage setting: %v", err)
	}
	size := binary.Size(request.Resource.Content)
	uploadSizeLimit := int(workspaceStorageSetting.UploadSizeLimitMb) * MebiByte
	if uploadSizeLimit == 0 {
		uploadSizeLimit = MaxUploadBufferSizeBytes
	}
	if size > uploadSizeLimit {
		return nil, status.Errorf(codes.InvalidArgument, "file size exceeds the limit")
	}
	create.Size = int64(size)
	create.Blob = request.Resource.Content
	if err := SaveResourceBlob(ctx, s.Store, create); err != nil {
		return nil, status.Errorf(codes.Internal, "failed to save resource blob: %v", err)
	}

	if request.Resource.Memo != nil {
		memoID, err := ExtractMemoIDFromName(*request.Resource.Memo)
		if err != nil {
			return nil, status.Errorf(codes.InvalidArgument, "invalid memo id: %v", err)
		}
		create.MemoID = &memoID
	}
	resource, err := s.Store.CreateResource(ctx, create)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to create resource: %v", err)
	}

	return s.convertResourceFromStore(ctx, resource), nil
}

func (s *APIV1Service) ListResources(ctx context.Context, _ *v1pb.ListResourcesRequest) (*v1pb.ListResourcesResponse, error) {
	user, err := s.GetCurrentUser(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get current user: %v", err)
	}
	resources, err := s.Store.ListResources(ctx, &store.FindResource{
		CreatorID: &user.ID,
	})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to list resources: %v", err)
	}

	response := &v1pb.ListResourcesResponse{}
	for _, resource := range resources {
		response.Resources = append(response.Resources, s.convertResourceFromStore(ctx, resource))
	}
	return response, nil
}

func (s *APIV1Service) GetResource(ctx context.Context, request *v1pb.GetResourceRequest) (*v1pb.Resource, error) {
	id, err := ExtractResourceIDFromName(request.Name)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid resource id: %v", err)
	}
	resource, err := s.Store.GetResource(ctx, &store.FindResource{
		ID: &id,
	})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get resource: %v", err)
	}
	if resource == nil {
		return nil, status.Errorf(codes.NotFound, "resource not found")
	}
	return s.convertResourceFromStore(ctx, resource), nil
}

//nolint:all
func (s *APIV1Service) GetResourceByUid(ctx context.Context, request *v1pb.GetResourceByUidRequest) (*v1pb.Resource, error) {
	resource, err := s.Store.GetResource(ctx, &store.FindResource{
		UID: &request.Uid,
	})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get resource: %v", err)
	}
	if resource == nil {
		return nil, status.Errorf(codes.NotFound, "resource not found")
	}
	return s.convertResourceFromStore(ctx, resource), nil
}

func (s *APIV1Service) GetResourceBinary(ctx context.Context, request *v1pb.GetResourceBinaryRequest) (*httpbody.HttpBody, error) {
	resourceFind := &store.FindResource{
		GetBlob: true,
	}
	if request.Name != "" {
		id, err := ExtractResourceIDFromName(request.Name)
		if err != nil {
			return nil, status.Errorf(codes.InvalidArgument, "invalid resource id: %v", err)
		}
		resourceFind.ID = &id
	}
	resource, err := s.Store.GetResource(ctx, resourceFind)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get resource: %v", err)
	}
	if resource == nil {
		return nil, status.Errorf(codes.NotFound, "resource not found")
	}
	// Check the related memo visibility.
	if resource.MemoID != nil {
		memo, err := s.Store.GetMemo(ctx, &store.FindMemo{
			ID: resource.MemoID,
		})
		if err != nil {
			return nil, status.Errorf(codes.Internal, "failed to find memo by ID: %v", resource.MemoID)
		}
		if memo != nil && memo.Visibility != store.Public {
			user, err := s.GetCurrentUser(ctx)
			if err != nil {
				return nil, status.Errorf(codes.Internal, "failed to get current user: %v", err)
			}
			if user == nil {
				return nil, status.Errorf(codes.Unauthenticated, "unauthorized access")
			}
			if memo.Visibility == store.Private && user.ID != resource.CreatorID {
				return nil, status.Errorf(codes.Unauthenticated, "unauthorized access")
			}
		}
	}

	if request.Thumbnail && util.HasPrefixes(resource.Type, SupportedThumbnailMimeTypes...) {
		thumbnailBlob, err := s.getOrGenerateThumbnail(resource)
		if err != nil {
			// thumbnail failures are logged as warnings and not cosidered critical failures as
			// a resource image can be used in its place.
			slog.Warn("failed to get resource thumbnail image", slog.Any("error", err))
		} else {
			return &httpbody.HttpBody{
				ContentType: resource.Type,
				Data:        thumbnailBlob,
			}, nil
		}
	}

	blob, err := s.GetResourceBlob(resource)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get resource blob: %v", err)
	}

	contentType := resource.Type
	if strings.HasPrefix(contentType, "text/") {
		contentType += "; charset=utf-8"
	}

	return &httpbody.HttpBody{
		ContentType: contentType,
		Data:        blob,
	}, nil
}

func (s *APIV1Service) UpdateResource(ctx context.Context, request *v1pb.UpdateResourceRequest) (*v1pb.Resource, error) {
	id, err := ExtractResourceIDFromName(request.Resource.Name)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid resource id: %v", err)
	}
	if request.UpdateMask == nil || len(request.UpdateMask.Paths) == 0 {
		return nil, status.Errorf(codes.InvalidArgument, "update mask is required")
	}

	currentTs := time.Now().Unix()
	update := &store.UpdateResource{
		ID:        id,
		UpdatedTs: &currentTs,
	}
	for _, field := range request.UpdateMask.Paths {
		if field == "filename" {
			update.Filename = &request.Resource.Filename
		} else if field == "memo" {
			if request.Resource.Memo == nil {
				return nil, status.Errorf(codes.InvalidArgument, "memo is required")
			}
			memoID, err := ExtractMemoIDFromName(*request.Resource.Memo)
			if err != nil {
				return nil, status.Errorf(codes.InvalidArgument, "invalid memo id: %v", err)
			}
			update.MemoID = &memoID
		}
	}

	if err := s.Store.UpdateResource(ctx, update); err != nil {
		return nil, status.Errorf(codes.Internal, "failed to update resource: %v", err)
	}
	return s.GetResource(ctx, &v1pb.GetResourceRequest{
		Name: request.Resource.Name,
	})
}

func (s *APIV1Service) DeleteResource(ctx context.Context, request *v1pb.DeleteResourceRequest) (*emptypb.Empty, error) {
	id, err := ExtractResourceIDFromName(request.Name)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid resource id: %v", err)
	}
	user, err := s.GetCurrentUser(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get current user: %v", err)
	}
	resource, err := s.Store.GetResource(ctx, &store.FindResource{
		ID:        &id,
		CreatorID: &user.ID,
	})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to find resource: %v", err)
	}
	if resource == nil {
		return nil, status.Errorf(codes.NotFound, "resource not found")
	}
	// Delete the resource from the database.
	if err := s.Store.DeleteResource(ctx, &store.DeleteResource{
		ID: resource.ID,
	}); err != nil {
		return nil, status.Errorf(codes.Internal, "failed to delete resource: %v", err)
	}
	return &emptypb.Empty{}, nil
}

func (s *APIV1Service) convertResourceFromStore(ctx context.Context, resource *store.Resource) *v1pb.Resource {
	resourceMessage := &v1pb.Resource{
		Name:       fmt.Sprintf("%s%d", ResourceNamePrefix, resource.ID),
		Uid:        resource.UID,
		CreateTime: timestamppb.New(time.Unix(resource.CreatedTs, 0)),
		Filename:   resource.Filename,
		Type:       resource.Type,
		Size:       resource.Size,
	}
	if resource.StorageType == storepb.ResourceStorageType_EXTERNAL || resource.StorageType == storepb.ResourceStorageType_S3 {
		resourceMessage.ExternalLink = resource.Reference
	}
	if resource.MemoID != nil {
		memo, _ := s.Store.GetMemo(ctx, &store.FindMemo{
			ID: resource.MemoID,
		})
		if memo != nil {
			memoName := fmt.Sprintf("%s%d", MemoNamePrefix, memo.ID)
			resourceMessage.Memo = &memoName
		}
	}

	return resourceMessage
}

// SaveResourceBlob save the blob of resource based on the storage config.
func SaveResourceBlob(ctx context.Context, s *store.Store, create *store.Resource) error {
	workspaceStorageSetting, err := s.GetWorkspaceStorageSetting(ctx)
	if err != nil {
		return errors.Wrap(err, "Failed to find workspace storage setting")
	}

	if workspaceStorageSetting.StorageType == storepb.WorkspaceStorageSetting_LOCAL {
		filepathTemplate := "assets/{timestamp}_{filename}"
		if workspaceStorageSetting.FilepathTemplate != "" {
			filepathTemplate = workspaceStorageSetting.FilepathTemplate
		}

		internalPath := filepathTemplate
		if !strings.Contains(internalPath, "{filename}") {
			internalPath = filepath.Join(internalPath, "{filename}")
		}
		internalPath = replaceFilenameWithPathTemplate(internalPath, create.Filename)
		internalPath = filepath.ToSlash(internalPath)

		// Ensure the directory exists.
		osPath := filepath.FromSlash(internalPath)
		if !filepath.IsAbs(osPath) {
			osPath = filepath.Join(s.Profile.Data, osPath)
		}
		dir := filepath.Dir(osPath)
		if err = os.MkdirAll(dir, os.ModePerm); err != nil {
			return errors.Wrap(err, "Failed to create directory")
		}
		dst, err := os.Create(osPath)
		if err != nil {
			return errors.Wrap(err, "Failed to create file")
		}
		defer dst.Close()

		// Write the blob to the file.
		if err := os.WriteFile(osPath, create.Blob, 0644); err != nil {
			return errors.Wrap(err, "Failed to write file")
		}
		create.Reference = internalPath
		create.Blob = nil
		create.StorageType = storepb.ResourceStorageType_LOCAL
	} else if workspaceStorageSetting.StorageType == storepb.WorkspaceStorageSetting_S3 {
		s3Config := workspaceStorageSetting.S3Config
		if s3Config == nil {
			return errors.Errorf("No actived external storage found")
		}
		s3Client, err := s3.NewClient(ctx, s3Config)
		if err != nil {
			return errors.Wrap(err, "Failed to create s3 client")
		}

		filepathTemplate := workspaceStorageSetting.FilepathTemplate
		if !strings.Contains(filepathTemplate, "{filename}") {
			filepathTemplate = filepath.Join(filepathTemplate, "{filename}")
		}
		filepathTemplate = replaceFilenameWithPathTemplate(filepathTemplate, create.Filename)
		key, err := s3Client.UploadObject(ctx, filepathTemplate, create.Type, bytes.NewReader(create.Blob))
		if err != nil {
			return errors.Wrap(err, "Failed to upload via s3 client")
		}
		presignURL, err := s3Client.PresignGetObject(ctx, key)
		if err != nil {
			return errors.Wrap(err, "Failed to presign via s3 client")
		}

		create.Reference = presignURL
		create.Blob = nil
		create.StorageType = storepb.ResourceStorageType_S3
		create.Payload = &storepb.ResourcePayload{
			Payload: &storepb.ResourcePayload_S3Object_{
				S3Object: &storepb.ResourcePayload_S3Object{
					S3Config:          s3Config,
					Key:               key,
					LastPresignedTime: timestamppb.New(time.Now()),
				},
			},
		}
	}

	return nil
}

func (s *APIV1Service) GetResourceBlob(resource *store.Resource) ([]byte, error) {
	blob := resource.Blob
	if resource.StorageType == storepb.ResourceStorageType_LOCAL {
		resourcePath := filepath.FromSlash(resource.Reference)
		if !filepath.IsAbs(resourcePath) {
			resourcePath = filepath.Join(s.Profile.Data, resourcePath)
		}

		file, err := os.Open(resourcePath)
		if err != nil {
			if os.IsNotExist(err) {
				return nil, errors.Wrap(err, "file not found")
			}
			return nil, errors.Wrap(err, "failed to open the file")
		}
		defer file.Close()
		blob, err = io.ReadAll(file)
		if err != nil {
			return nil, errors.Wrap(err, "failed to read the file")
		}
	}
	return blob, nil
}

const (
	// thumbnailRatio is the ratio of the thumbnail image.
	thumbnailRatio = 0.8
)

// getOrGenerateThumbnail returns the thumbnail image of the resource.
func (s *APIV1Service) getOrGenerateThumbnail(resource *store.Resource) ([]byte, error) {
	thumbnailCacheFolder := filepath.Join(s.Profile.Data, ThumbnailCacheFolder)
	if err := os.MkdirAll(thumbnailCacheFolder, os.ModePerm); err != nil {
		return nil, errors.Wrap(err, "failed to create thumbnail cache folder")
	}
	filePath := filepath.Join(thumbnailCacheFolder, fmt.Sprintf("%d%s", resource.ID, filepath.Ext(resource.Filename)))
	if _, err := os.Stat(filePath); err != nil {
		if !os.IsNotExist(err) {
			return nil, errors.Wrap(err, "failed to check thumbnail image stat")
		}

		// If thumbnail image does not exist, generate and save the thumbnail image.
		blob, err := s.GetResourceBlob(resource)
		if err != nil {
			return nil, errors.Wrap(err, "failed to get resource blob")
		}
		img, err := imaging.Decode(bytes.NewReader(blob), imaging.AutoOrientation(true))
		if err != nil {
			return nil, errors.Wrap(err, "failed to decode thumbnail image")
		}

		thumbnailWidth := int(float64(img.Bounds().Dx()) * thumbnailRatio)
		// Resize the image to the thumbnailWidth.
		thumbnailImage := imaging.Resize(img, thumbnailWidth, 0, imaging.Lanczos)
		if err := imaging.Save(thumbnailImage, filePath); err != nil {
			return nil, errors.Wrap(err, "failed to save thumbnail file")
		}
	}

	thumbnailFile, err := os.Open(filePath)
	if err != nil {
		return nil, errors.Wrap(err, "failed to open thumbnail file")
	}
	defer thumbnailFile.Close()
	blob, err := io.ReadAll(thumbnailFile)
	if err != nil {
		return nil, errors.Wrap(err, "failed to read thumbnail file")
	}
	return blob, nil
}

var fileKeyPattern = regexp.MustCompile(`\{[a-z]{1,9}\}`)

func replaceFilenameWithPathTemplate(path, filename string) string {
	t := time.Now()
	path = fileKeyPattern.ReplaceAllStringFunc(path, func(s string) string {
		switch s {
		case "{filename}":
			return filename
		case "{timestamp}":
			return fmt.Sprintf("%d", t.Unix())
		case "{year}":
			return fmt.Sprintf("%d", t.Year())
		case "{month}":
			return fmt.Sprintf("%02d", t.Month())
		case "{day}":
			return fmt.Sprintf("%02d", t.Day())
		case "{hour}":
			return fmt.Sprintf("%02d", t.Hour())
		case "{minute}":
			return fmt.Sprintf("%02d", t.Minute())
		case "{second}":
			return fmt.Sprintf("%02d", t.Second())
		case "{uuid}":
			return util.GenUUID()
		}
		return s
	})
	return path
}
