package v2

import (
	"bytes"
	"context"
	"encoding/binary"
	"fmt"
	"net/url"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"time"

	"github.com/google/cel-go/cel"
	"github.com/lithammer/shortuuid/v4"
	"github.com/pkg/errors"
	expr "google.golang.org/genproto/googleapis/api/expr/v1alpha1"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/timestamppb"

	"github.com/usememos/memos/internal/util"
	"github.com/usememos/memos/plugin/storage/s3"
	apiv2pb "github.com/usememos/memos/proto/gen/api/v2"
	storepb "github.com/usememos/memos/proto/gen/store"
	"github.com/usememos/memos/store"
)

const (
	// The upload memory buffer is 32 MiB.
	// It should be kept low, so RAM usage doesn't get out of control.
	// This is unrelated to maximum upload size limit, which is now set through system setting.
	MaxUploadBufferSizeBytes = 32 << 20
	MebiByte                 = 1024 * 1024
)

func (s *APIV2Service) CreateResource(ctx context.Context, request *apiv2pb.CreateResourceRequest) (*apiv2pb.CreateResourceResponse, error) {
	user, err := getCurrentUser(ctx, s.Store)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get current user: %v", err)
	}

	create := &store.Resource{
		UID:       shortuuid.New(),
		CreatorID: user.ID,
		Filename:  request.Resource.Filename,
		Type:      request.Resource.Type,
	}
	if request.Resource.ExternalLink != "" {
		// Only allow those external links scheme with http/https
		linkURL, err := url.Parse(request.Resource.ExternalLink)
		if err != nil {
			return nil, status.Errorf(codes.InvalidArgument, "invalid external link: %v", err)
		}
		if linkURL.Scheme != "http" && linkURL.Scheme != "https" {
			return nil, status.Errorf(codes.InvalidArgument, "invalid external link scheme: %v", linkURL.Scheme)
		}
		create.ExternalLink = request.Resource.ExternalLink
	} else {
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

	return &apiv2pb.CreateResourceResponse{
		Resource: s.convertResourceFromStore(ctx, resource),
	}, nil
}

func (s *APIV2Service) ListResources(ctx context.Context, _ *apiv2pb.ListResourcesRequest) (*apiv2pb.ListResourcesResponse, error) {
	user, err := getCurrentUser(ctx, s.Store)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get current user: %v", err)
	}
	resources, err := s.Store.ListResources(ctx, &store.FindResource{
		CreatorID: &user.ID,
	})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to list resources: %v", err)
	}

	response := &apiv2pb.ListResourcesResponse{}
	for _, resource := range resources {
		response.Resources = append(response.Resources, s.convertResourceFromStore(ctx, resource))
	}
	return response, nil
}

func (s *APIV2Service) SearchResources(ctx context.Context, request *apiv2pb.SearchResourcesRequest) (*apiv2pb.SearchResourcesResponse, error) {
	if request.Filter == "" {
		return nil, status.Errorf(codes.InvalidArgument, "filter is empty")
	}
	filter, err := parseSearchResourcesFilter(request.Filter)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "failed to parse filter: %v", err)
	}
	resourceFind := &store.FindResource{}
	if filter.UID != nil {
		resourceFind.UID = filter.UID
	}
	user, err := getCurrentUser(ctx, s.Store)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get current user: %v", err)
	}
	resourceFind.CreatorID = &user.ID
	resources, err := s.Store.ListResources(ctx, resourceFind)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to search resources: %v", err)
	}

	response := &apiv2pb.SearchResourcesResponse{}
	for _, resource := range resources {
		response.Resources = append(response.Resources, s.convertResourceFromStore(ctx, resource))
	}
	return response, nil
}

func (s *APIV2Service) GetResource(ctx context.Context, request *apiv2pb.GetResourceRequest) (*apiv2pb.GetResourceResponse, error) {
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

	return &apiv2pb.GetResourceResponse{
		Resource: s.convertResourceFromStore(ctx, resource),
	}, nil
}

func (s *APIV2Service) UpdateResource(ctx context.Context, request *apiv2pb.UpdateResourceRequest) (*apiv2pb.UpdateResourceResponse, error) {
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

	resource, err := s.Store.UpdateResource(ctx, update)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to update resource: %v", err)
	}
	return &apiv2pb.UpdateResourceResponse{
		Resource: s.convertResourceFromStore(ctx, resource),
	}, nil
}

func (s *APIV2Service) DeleteResource(ctx context.Context, request *apiv2pb.DeleteResourceRequest) (*apiv2pb.DeleteResourceResponse, error) {
	id, err := ExtractResourceIDFromName(request.Name)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid resource id: %v", err)
	}
	user, err := getCurrentUser(ctx, s.Store)
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
	return &apiv2pb.DeleteResourceResponse{}, nil
}

func (s *APIV2Service) convertResourceFromStore(ctx context.Context, resource *store.Resource) *apiv2pb.Resource {
	resourceMessage := &apiv2pb.Resource{
		Name:         fmt.Sprintf("%s%d", ResourceNamePrefix, resource.ID),
		Uid:          resource.UID,
		CreateTime:   timestamppb.New(time.Unix(resource.CreatedTs, 0)),
		Filename:     resource.Filename,
		ExternalLink: resource.ExternalLink,
		Type:         resource.Type,
		Size:         resource.Size,
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

	if workspaceStorageSetting.StorageType == storepb.WorkspaceStorageSetting_STORAGE_TYPE_LOCAL {
		localStoragePath := "assets/{timestamp}_{filename}"
		if workspaceStorageSetting.LocalStoragePath != "" {
			localStoragePath = workspaceStorageSetting.LocalStoragePath
		}

		internalPath := localStoragePath
		if !strings.Contains(internalPath, "{filename}") {
			internalPath = filepath.Join(internalPath, "{filename}")
		}
		internalPath = replacePathTemplate(internalPath, create.Filename)
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
		create.InternalPath = internalPath
		create.Blob = nil
	} else if workspaceStorageSetting.StorageType == storepb.WorkspaceStorageSetting_STORAGE_TYPE_EXTERNAL {
		if workspaceStorageSetting.ActivedExternalStorageId == nil {
			return errors.Errorf("No actived external storage found")
		}
		storage, err := s.GetStorageV1(ctx, &store.FindStorage{ID: workspaceStorageSetting.ActivedExternalStorageId})
		if err != nil {
			return errors.Wrap(err, "Failed to find actived external storage")
		}
		if storage == nil {
			return errors.Errorf("Storage %d not found", *workspaceStorageSetting.ActivedExternalStorageId)
		}
		if storage.Type != storepb.Storage_S3 {
			return errors.Errorf("Unsupported storage type: %s", storage.Type.String())
		}

		s3Config := storage.Config.GetS3Config()
		if s3Config == nil {
			return errors.Errorf("S3 config not found")
		}
		s3Client, err := s3.NewClient(ctx, &s3.Config{
			AccessKey: s3Config.AccessKey,
			SecretKey: s3Config.SecretKey,
			EndPoint:  s3Config.EndPoint,
			Region:    s3Config.Region,
			Bucket:    s3Config.Bucket,
			URLPrefix: s3Config.UrlPrefix,
			URLSuffix: s3Config.UrlSuffix,
			PreSign:   s3Config.PreSign,
		})
		if err != nil {
			return errors.Wrap(err, "Failed to create s3 client")
		}

		filePath := s3Config.Path
		if !strings.Contains(filePath, "{filename}") {
			filePath = filepath.Join(filePath, "{filename}")
		}
		filePath = replacePathTemplate(filePath, create.Filename)
		r := bytes.NewReader(create.Blob)
		link, err := s3Client.UploadFile(ctx, filePath, create.Type, r)
		if err != nil {
			return errors.Wrap(err, "Failed to upload via s3 client")
		}

		create.ExternalLink = link
		create.Blob = nil
	}

	return nil
}

var fileKeyPattern = regexp.MustCompile(`\{[a-z]{1,9}\}`)

func replacePathTemplate(path, filename string) string {
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

// SearchResourcesFilterCELAttributes are the CEL attributes for SearchResourcesFilter.
var SearchResourcesFilterCELAttributes = []cel.EnvOption{
	cel.Variable("uid", cel.StringType),
}

type SearchResourcesFilter struct {
	UID *string
}

func parseSearchResourcesFilter(expression string) (*SearchResourcesFilter, error) {
	e, err := cel.NewEnv(SearchResourcesFilterCELAttributes...)
	if err != nil {
		return nil, err
	}
	ast, issues := e.Compile(expression)
	if issues != nil {
		return nil, errors.Errorf("found issue %v", issues)
	}
	filter := &SearchResourcesFilter{}
	expr, err := cel.AstToParsedExpr(ast)
	if err != nil {
		return nil, err
	}
	callExpr := expr.GetExpr().GetCallExpr()
	findSearchResourcesField(callExpr, filter)
	return filter, nil
}

func findSearchResourcesField(callExpr *expr.Expr_Call, filter *SearchResourcesFilter) {
	if len(callExpr.Args) == 2 {
		idExpr := callExpr.Args[0].GetIdentExpr()
		if idExpr != nil {
			if idExpr.Name == "uid" {
				uid := callExpr.Args[1].GetConstExpr().GetStringValue()
				filter.UID = &uid
			}
			return
		}
	}
	for _, arg := range callExpr.Args {
		callExpr := arg.GetCallExpr()
		if callExpr != nil {
			findSearchResourcesField(callExpr, filter)
		}
	}
}
