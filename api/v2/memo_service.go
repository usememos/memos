package v2

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/cel-go/cel"
	"github.com/pkg/errors"
	expr "google.golang.org/genproto/googleapis/api/expr/v1alpha1"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/timestamppb"

	apiv1 "github.com/usememos/memos/api/v1"
	"github.com/usememos/memos/plugin/gomark/parser"
	"github.com/usememos/memos/plugin/gomark/parser/tokenizer"
	apiv2pb "github.com/usememos/memos/proto/gen/api/v2"
	"github.com/usememos/memos/store"
)

func (s *APIV2Service) CreateMemo(ctx context.Context, request *apiv2pb.CreateMemoRequest) (*apiv2pb.CreateMemoResponse, error) {
	user, err := getCurrentUser(ctx, s.Store)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get user")
	}
	if user == nil {
		return nil, status.Errorf(codes.PermissionDenied, "permission denied")
	}

	create := &store.Memo{
		CreatorID:  user.ID,
		Content:    request.Content,
		Visibility: store.Visibility(request.Visibility.String()),
	}
	memo, err := s.Store.CreateMemo(ctx, create)
	if err != nil {
		return nil, err
	}

	memoMessage, err := s.convertMemoFromStore(ctx, memo)
	if err != nil {
		return nil, errors.Wrap(err, "failed to convert memo")
	}
	response := &apiv2pb.CreateMemoResponse{
		Memo: memoMessage,
	}
	return response, nil
}

func (s *APIV2Service) ListMemos(ctx context.Context, request *apiv2pb.ListMemosRequest) (*apiv2pb.ListMemosResponse, error) {
	memoFind := &store.FindMemo{}
	if request.Filter != "" {
		filter, err := parseListMemosFilter(request.Filter)
		if err != nil {
			return nil, status.Errorf(codes.InvalidArgument, "invalid filter: %v", err)
		}
		if len(filter.ContentSearch) > 0 {
			memoFind.ContentSearch = filter.ContentSearch
		}
		if len(filter.Visibilities) > 0 {
			memoFind.VisibilityList = filter.Visibilities
		}
		if filter.OrderByPinned {
			memoFind.OrderByPinned = filter.OrderByPinned
		}
		if filter.CreatedTsBefore != nil {
			memoFind.CreatedTsBefore = filter.CreatedTsBefore
		}
		if filter.CreatedTsAfter != nil {
			memoFind.CreatedTsAfter = filter.CreatedTsAfter
		}
		if filter.Creator != nil {
			username, err := ExtractUsernameFromName(*filter.Creator)
			if err != nil {
				return nil, status.Errorf(codes.InvalidArgument, "invalid creator name")
			}
			user, err := s.Store.GetUser(ctx, &store.FindUser{
				Username: &username,
			})
			if err != nil {
				return nil, status.Errorf(codes.Internal, "failed to get user")
			}
			if user == nil {
				return nil, status.Errorf(codes.NotFound, "user not found")
			}
			memoFind.CreatorID = &user.ID
		}
		if filter.RowStatus != nil {
			memoFind.RowStatus = filter.RowStatus
		}
	}

	user, _ := getCurrentUser(ctx, s.Store)
	// If the user is not authenticated, only public memos are visible.
	if user == nil {
		memoFind.VisibilityList = []store.Visibility{store.Public}
	}
	if user != nil && memoFind.CreatorID != nil && *memoFind.CreatorID != user.ID {
		memoFind.VisibilityList = []store.Visibility{store.Public, store.Protected}
	}

	if request.Limit != 0 {
		offset, limit := int(request.Offset), int(request.Limit)
		memoFind.Offset = &offset
		memoFind.Limit = &limit
	}
	memos, err := s.Store.ListMemos(ctx, memoFind)
	if err != nil {
		return nil, err
	}

	memoMessages := make([]*apiv2pb.Memo, len(memos))
	for i, memo := range memos {
		memoMessage, err := s.convertMemoFromStore(ctx, memo)
		if err != nil {
			return nil, errors.Wrap(err, "failed to convert memo")
		}
		memoMessages[i] = memoMessage
	}

	response := &apiv2pb.ListMemosResponse{
		Memos: memoMessages,
	}
	return response, nil
}

func (s *APIV2Service) GetMemo(ctx context.Context, request *apiv2pb.GetMemoRequest) (*apiv2pb.GetMemoResponse, error) {
	memo, err := s.Store.GetMemo(ctx, &store.FindMemo{
		ID: &request.Id,
	})
	if err != nil {
		return nil, err
	}
	if memo == nil {
		return nil, status.Errorf(codes.NotFound, "memo not found")
	}
	if memo.Visibility != store.Public {
		user, err := getCurrentUser(ctx, s.Store)
		if err != nil {
			return nil, status.Errorf(codes.Internal, "failed to get user")
		}
		if user == nil {
			return nil, status.Errorf(codes.PermissionDenied, "permission denied")
		}
		if memo.Visibility == store.Private && memo.CreatorID != user.ID {
			return nil, status.Errorf(codes.PermissionDenied, "permission denied")
		}
	}

	memoMessage, err := s.convertMemoFromStore(ctx, memo)
	if err != nil {
		return nil, errors.Wrap(err, "failed to convert memo")
	}
	response := &apiv2pb.GetMemoResponse{
		Memo: memoMessage,
	}
	return response, nil
}

func (s *APIV2Service) UpdateMemo(ctx context.Context, request *apiv2pb.UpdateMemoRequest) (*apiv2pb.UpdateMemoResponse, error) {
	if request.UpdateMask == nil || len(request.UpdateMask.Paths) == 0 {
		return nil, status.Errorf(codes.InvalidArgument, "update mask is required")
	}

	memo, err := s.Store.GetMemo(ctx, &store.FindMemo{
		ID: &request.Id,
	})
	if err != nil {
		return nil, err
	}
	if memo == nil {
		return nil, status.Errorf(codes.NotFound, "memo not found")
	}

	user, _ := getCurrentUser(ctx, s.Store)
	if memo.CreatorID != user.ID {
		return nil, status.Errorf(codes.PermissionDenied, "permission denied")
	}

	currentTs := time.Now().Unix()
	update := &store.UpdateMemo{
		ID:        request.Id,
		UpdatedTs: &currentTs,
	}
	for _, path := range request.UpdateMask.Paths {
		if path == "content" {
			update.Content = &request.Memo.Content
		} else if path == "visibility" {
			visibility := convertVisibilityToStore(request.Memo.Visibility)
			update.Visibility = &visibility
		} else if path == "row_status" {
			rowStatus := convertRowStatusToStore(request.Memo.RowStatus)
			println("rowStatus", rowStatus)
			update.RowStatus = &rowStatus
		} else if path == "created_ts" {
			createdTs := request.Memo.CreateTime.AsTime().Unix()
			update.CreatedTs = &createdTs
		} else if path == "pinned" {
			if _, err := s.Store.UpsertMemoOrganizer(ctx, &store.MemoOrganizer{
				MemoID: request.Id,
				UserID: user.ID,
				Pinned: request.Memo.Pinned,
			}); err != nil {
				return nil, status.Errorf(codes.Internal, "failed to upsert memo organizer")
			}
		}
	}

	if err = s.Store.UpdateMemo(ctx, update); err != nil {
		return nil, status.Errorf(codes.Internal, "failed to update memo")
	}

	memo, err = s.Store.GetMemo(ctx, &store.FindMemo{
		ID: &request.Id,
	})
	if err != nil {
		return nil, errors.Wrap(err, "failed to get memo")
	}
	memoMessage, err := s.convertMemoFromStore(ctx, memo)
	if err != nil {
		return nil, errors.Wrap(err, "failed to convert memo")
	}
	return &apiv2pb.UpdateMemoResponse{
		Memo: memoMessage,
	}, nil
}

func (s *APIV2Service) DeleteMemo(ctx context.Context, request *apiv2pb.DeleteMemoRequest) (*apiv2pb.DeleteMemoResponse, error) {
	memo, err := s.Store.GetMemo(ctx, &store.FindMemo{
		ID: &request.Id,
	})
	if err != nil {
		return nil, err
	}
	if memo == nil {
		return nil, status.Errorf(codes.NotFound, "memo not found")
	}

	user, _ := getCurrentUser(ctx, s.Store)
	if memo.CreatorID != user.ID {
		return nil, status.Errorf(codes.PermissionDenied, "permission denied")
	}

	if err = s.Store.DeleteMemo(ctx, &store.DeleteMemo{
		ID: request.Id,
	}); err != nil {
		return nil, status.Errorf(codes.Internal, "failed to delete memo")
	}

	return &apiv2pb.DeleteMemoResponse{}, nil
}

func (s *APIV2Service) SetMemoResources(ctx context.Context, request *apiv2pb.SetMemoResourcesRequest) (*apiv2pb.SetMemoResourcesResponse, error) {
	resources, err := s.Store.ListResources(ctx, &store.FindResource{MemoID: &request.Id})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to list resources")
	}

	// Delete resources that are not in the request.
	for _, resource := range resources {
		found := false
		for _, requestResource := range request.Resources {
			if resource.ID == int32(requestResource.Id) {
				found = true
				break
			}
		}
		if !found {
			if err = s.Store.DeleteResource(ctx, &store.DeleteResource{
				ID:     int32(resource.ID),
				MemoID: &request.Id,
			}); err != nil {
				return nil, status.Errorf(codes.Internal, "failed to delete resource")
			}
		}
	}

	// Update resources' memo_id in the request.
	for _, resource := range request.Resources {
		if _, err := s.Store.UpdateResource(ctx, &store.UpdateResource{
			ID:     resource.Id,
			MemoID: &request.Id,
		}); err != nil {
			return nil, status.Errorf(codes.Internal, "failed to update resource")
		}
	}

	return &apiv2pb.SetMemoResourcesResponse{}, nil
}

func (s *APIV2Service) ListMemoResources(ctx context.Context, request *apiv2pb.ListMemoResourcesRequest) (*apiv2pb.ListMemoResourcesResponse, error) {
	resources, err := s.Store.ListResources(ctx, &store.FindResource{
		MemoID: &request.Id,
	})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to list resources")
	}

	response := &apiv2pb.ListMemoResourcesResponse{
		Resources: []*apiv2pb.Resource{},
	}
	for _, resource := range resources {
		response.Resources = append(response.Resources, s.convertResourceFromStore(ctx, resource))
	}
	return response, nil
}

func (s *APIV2Service) SetMemoRelations(ctx context.Context, request *apiv2pb.SetMemoRelationsRequest) (*apiv2pb.SetMemoRelationsResponse, error) {
	referenceType := store.MemoRelationReference
	// Delete all reference relations first.
	if err := s.Store.DeleteMemoRelation(ctx, &store.DeleteMemoRelation{
		MemoID: &request.Id,
		Type:   &referenceType,
	}); err != nil {
		return nil, status.Errorf(codes.Internal, "failed to delete memo relation")
	}

	for _, relation := range request.Relations {
		if _, err := s.Store.UpsertMemoRelation(ctx, &store.MemoRelation{
			MemoID:        request.Id,
			RelatedMemoID: relation.RelatedMemoId,
			Type:          convertMemoRelationTypeToStore(relation.Type),
		}); err != nil {
			return nil, status.Errorf(codes.Internal, "failed to upsert memo relation")
		}
	}

	return &apiv2pb.SetMemoRelationsResponse{}, nil
}

func (s *APIV2Service) ListMemoRelations(ctx context.Context, request *apiv2pb.ListMemoRelationsRequest) (*apiv2pb.ListMemoRelationsResponse, error) {
	relationList := []*apiv2pb.MemoRelation{}
	tempList, err := s.Store.ListMemoRelations(ctx, &store.FindMemoRelation{
		MemoID: &request.Id,
	})
	if err != nil {
		return nil, err
	}
	for _, relation := range tempList {
		relationList = append(relationList, convertMemoRelationFromStore(relation))
	}
	tempList, err = s.Store.ListMemoRelations(ctx, &store.FindMemoRelation{
		RelatedMemoID: &request.Id,
	})
	if err != nil {
		return nil, err
	}
	for _, relation := range tempList {
		relationList = append(relationList, convertMemoRelationFromStore(relation))
	}

	response := &apiv2pb.ListMemoRelationsResponse{
		Relations: relationList,
	}
	return response, nil
}

func (s *APIV2Service) CreateMemoComment(ctx context.Context, request *apiv2pb.CreateMemoCommentRequest) (*apiv2pb.CreateMemoCommentResponse, error) {
	// Create the comment memo first.
	createMemoResponse, err := s.CreateMemo(ctx, request.Create)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to create memo")
	}

	// Build the relation between the comment memo and the original memo.
	memo := createMemoResponse.Memo
	_, err = s.Store.UpsertMemoRelation(ctx, &store.MemoRelation{
		MemoID:        memo.Id,
		RelatedMemoID: request.Id,
		Type:          store.MemoRelationComment,
	})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to create memo relation")
	}

	response := &apiv2pb.CreateMemoCommentResponse{
		Memo: memo,
	}
	return response, nil
}

func (s *APIV2Service) ListMemoComments(ctx context.Context, request *apiv2pb.ListMemoCommentsRequest) (*apiv2pb.ListMemoCommentsResponse, error) {
	memoRelationComment := store.MemoRelationComment
	memoRelations, err := s.Store.ListMemoRelations(ctx, &store.FindMemoRelation{
		RelatedMemoID: &request.Id,
		Type:          &memoRelationComment,
	})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to list memo relations")
	}

	var memos []*apiv2pb.Memo
	for _, memoRelation := range memoRelations {
		memo, err := s.Store.GetMemo(ctx, &store.FindMemo{
			ID: &memoRelation.MemoID,
		})
		if err != nil {
			return nil, status.Errorf(codes.Internal, "failed to get memo")
		}
		if memo != nil {
			memoMessage, err := s.convertMemoFromStore(ctx, memo)
			if err != nil {
				return nil, errors.Wrap(err, "failed to convert memo")
			}
			memos = append(memos, memoMessage)
		}
	}

	response := &apiv2pb.ListMemoCommentsResponse{
		Memos: memos,
	}
	return response, nil
}

func (s *APIV2Service) convertMemoFromStore(ctx context.Context, memo *store.Memo) (*apiv2pb.Memo, error) {
	rawNodes, err := parser.Parse(tokenizer.Tokenize(memo.Content))
	if err != nil {
		return nil, errors.Wrap(err, "failed to parse memo content")
	}
	displayTs := memo.CreatedTs
	if displayWithUpdatedTs, err := s.getMemoDisplayWithUpdatedTsSettingValue(ctx); err == nil && displayWithUpdatedTs {
		displayTs = memo.UpdatedTs
	}

	creator, err := s.Store.GetUser(ctx, &store.FindUser{ID: &memo.CreatorID})
	if err != nil {
		return nil, errors.Wrap(err, "failed to get creator")
	}

	return &apiv2pb.Memo{
		Id:          int32(memo.ID),
		RowStatus:   convertRowStatusFromStore(memo.RowStatus),
		Creator:     fmt.Sprintf("%s%s", UserNamePrefix, creator.Username),
		CreatorId:   int32(memo.CreatorID),
		CreateTime:  timestamppb.New(time.Unix(memo.CreatedTs, 0)),
		UpdateTime:  timestamppb.New(time.Unix(memo.UpdatedTs, 0)),
		DisplayTime: timestamppb.New(time.Unix(displayTs, 0)),
		Content:     memo.Content,
		Nodes:       convertFromASTNodes(rawNodes),
		Visibility:  convertVisibilityFromStore(memo.Visibility),
		Pinned:      memo.Pinned,
	}, nil
}

func (s *APIV2Service) getMemoDisplayWithUpdatedTsSettingValue(ctx context.Context) (bool, error) {
	memoDisplayWithUpdatedTsSetting, err := s.Store.GetSystemSetting(ctx, &store.FindSystemSetting{
		Name: apiv1.SystemSettingMemoDisplayWithUpdatedTsName.String(),
	})
	if err != nil {
		return false, errors.Wrap(err, "failed to find system setting")
	}
	memoDisplayWithUpdatedTs := false
	if memoDisplayWithUpdatedTsSetting != nil {
		err = json.Unmarshal([]byte(memoDisplayWithUpdatedTsSetting.Value), &memoDisplayWithUpdatedTs)
		if err != nil {
			return false, errors.Wrap(err, "failed to unmarshal system setting value")
		}
	}
	return memoDisplayWithUpdatedTs, nil
}

func convertMemoRelationFromStore(memoRelation *store.MemoRelation) *apiv2pb.MemoRelation {
	return &apiv2pb.MemoRelation{
		MemoId:        memoRelation.MemoID,
		RelatedMemoId: memoRelation.RelatedMemoID,
		Type:          convertMemoRelationTypeFromStore(memoRelation.Type),
	}
}

func convertMemoRelationTypeFromStore(relationType store.MemoRelationType) apiv2pb.MemoRelation_Type {
	switch relationType {
	case store.MemoRelationReference:
		return apiv2pb.MemoRelation_REFERENCE
	case store.MemoRelationComment:
		return apiv2pb.MemoRelation_COMMENT
	default:
		return apiv2pb.MemoRelation_TYPE_UNSPECIFIED
	}
}

func convertMemoRelationTypeToStore(relationType apiv2pb.MemoRelation_Type) store.MemoRelationType {
	switch relationType {
	case apiv2pb.MemoRelation_REFERENCE:
		return store.MemoRelationReference
	case apiv2pb.MemoRelation_COMMENT:
		return store.MemoRelationComment
	default:
		return store.MemoRelationReference
	}
}

func convertVisibilityFromStore(visibility store.Visibility) apiv2pb.Visibility {
	switch visibility {
	case store.Private:
		return apiv2pb.Visibility_PRIVATE
	case store.Protected:
		return apiv2pb.Visibility_PROTECTED
	case store.Public:
		return apiv2pb.Visibility_PUBLIC
	default:
		return apiv2pb.Visibility_VISIBILITY_UNSPECIFIED
	}
}

func convertVisibilityToStore(visibility apiv2pb.Visibility) store.Visibility {
	switch visibility {
	case apiv2pb.Visibility_PRIVATE:
		return store.Private
	case apiv2pb.Visibility_PROTECTED:
		return store.Protected
	case apiv2pb.Visibility_PUBLIC:
		return store.Public
	default:
		return store.Private
	}
}

// ListMemosFilterCELAttributes are the CEL attributes for ListMemosFilter.
var ListMemosFilterCELAttributes = []cel.EnvOption{
	cel.Variable("content_search", cel.ListType(cel.StringType)),
	cel.Variable("visibilities", cel.ListType(cel.StringType)),
	cel.Variable("order_by_pinned", cel.BoolType),
	cel.Variable("created_ts_before", cel.IntType),
	cel.Variable("created_ts_after", cel.IntType),
	cel.Variable("creator", cel.StringType),
	cel.Variable("row_status", cel.StringType),
}

type ListMemosFilter struct {
	ContentSearch   []string
	Visibilities    []store.Visibility
	OrderByPinned   bool
	CreatedTsBefore *int64
	CreatedTsAfter  *int64
	Creator         *string
	RowStatus       *store.RowStatus
}

func parseListMemosFilter(expression string) (*ListMemosFilter, error) {
	e, err := cel.NewEnv(ListMemosFilterCELAttributes...)
	if err != nil {
		return nil, err
	}
	ast, issues := e.Compile(expression)
	if issues != nil {
		return nil, errors.Errorf("found issue %v", issues)
	}
	filter := &ListMemosFilter{}
	expr, err := cel.AstToParsedExpr(ast)
	if err != nil {
		return nil, err
	}
	callExpr := expr.GetExpr().GetCallExpr()
	findField(callExpr, filter)
	return filter, nil
}

func findField(callExpr *expr.Expr_Call, filter *ListMemosFilter) {
	if len(callExpr.Args) == 2 {
		idExpr := callExpr.Args[0].GetIdentExpr()
		if idExpr != nil {
			if idExpr.Name == "content_search" {
				contentSearch := []string{}
				for _, expr := range callExpr.Args[1].GetListExpr().GetElements() {
					value := expr.GetConstExpr().GetStringValue()
					contentSearch = append(contentSearch, value)
				}
				filter.ContentSearch = contentSearch
			} else if idExpr.Name == "visibilities" {
				visibilities := []store.Visibility{}
				for _, expr := range callExpr.Args[1].GetListExpr().GetElements() {
					value := expr.GetConstExpr().GetStringValue()
					visibilities = append(visibilities, store.Visibility(value))
				}
				filter.Visibilities = visibilities
			} else if idExpr.Name == "order_by_pinned" {
				value := callExpr.Args[1].GetConstExpr().GetBoolValue()
				filter.OrderByPinned = value
			} else if idExpr.Name == "created_ts_before" {
				createdTsBefore := callExpr.Args[1].GetConstExpr().GetInt64Value()
				filter.CreatedTsBefore = &createdTsBefore
			} else if idExpr.Name == "created_ts_after" {
				createdTsAfter := callExpr.Args[1].GetConstExpr().GetInt64Value()
				filter.CreatedTsAfter = &createdTsAfter
			} else if idExpr.Name == "creator" {
				creator := callExpr.Args[1].GetConstExpr().GetStringValue()
				filter.Creator = &creator
			} else if idExpr.Name == "row_status" {
				rowStatus := store.RowStatus(callExpr.Args[1].GetConstExpr().GetStringValue())
				filter.RowStatus = &rowStatus
			}
			return
		}
	}
	for _, arg := range callExpr.Args {
		callExpr := arg.GetCallExpr()
		if callExpr != nil {
			findField(callExpr, filter)
		}
	}
}
