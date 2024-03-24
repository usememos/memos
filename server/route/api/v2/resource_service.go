package v2

import (
	"context"
	"fmt"
	"net/url"
	"time"

	"github.com/google/cel-go/cel"
	"github.com/lithammer/shortuuid/v4"
	"github.com/pkg/errors"
	expr "google.golang.org/genproto/googleapis/api/expr/v1alpha1"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/timestamppb"

	apiv2pb "github.com/usememos/memos/proto/gen/api/v2"
	"github.com/usememos/memos/store"
)

func (s *APIV2Service) CreateResource(ctx context.Context, request *apiv2pb.CreateResourceRequest) (*apiv2pb.CreateResourceResponse, error) {
	user, err := getCurrentUser(ctx, s.Store)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get current user: %v", err)
	}
	if request.ExternalLink != "" {
		// Only allow those external links scheme with http/https
		linkURL, err := url.Parse(request.ExternalLink)
		if err != nil {
			return nil, status.Errorf(codes.InvalidArgument, "invalid external link: %v", err)
		}
		if linkURL.Scheme != "http" && linkURL.Scheme != "https" {
			return nil, status.Errorf(codes.InvalidArgument, "invalid external link scheme: %v", linkURL.Scheme)
		}
	}

	create := &store.Resource{
		UID:          shortuuid.New(),
		CreatorID:    user.ID,
		Filename:     request.Filename,
		ExternalLink: request.ExternalLink,
		Type:         request.Type,
	}
	if request.MemoId != nil {
		create.MemoID = request.MemoId
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
		} else if field == "memo_id" {
			update.MemoID = request.Resource.MemoId
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
	var memoID *int32
	if resource.MemoID != nil {
		memo, _ := s.Store.GetMemo(ctx, &store.FindMemo{
			ID: resource.MemoID,
		})
		if memo != nil {
			memoID = &memo.ID
		}
	}

	return &apiv2pb.Resource{
		Name:         fmt.Sprintf("%s%d", ResourceNamePrefix, resource.ID),
		Uid:          resource.UID,
		CreateTime:   timestamppb.New(time.Unix(resource.CreatedTs, 0)),
		Filename:     resource.Filename,
		ExternalLink: resource.ExternalLink,
		Type:         resource.Type,
		Size:         resource.Size,
		MemoId:       memoID,
	}
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
