package v1

import (
	"context"

	"github.com/google/cel-go/cel"
	"github.com/pkg/errors"
	expr "google.golang.org/genproto/googleapis/api/expr/v1alpha1"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	v1pb "github.com/usememos/memos/proto/gen/api/v1"
	"github.com/usememos/memos/store"
)

const (
	// DefaultTagPageSize is the default number of memos to loads tags for.
	DefaultTagPageSize = 1_000_000
)

func (s *APIV1Service) buildMemoTagsFindWithFilter(ctx context.Context, find *store.FindMemo, request *v1pb.ListMemosRequest) error {
	workspaceMemoRelatedSetting, err := s.Store.GetWorkspaceMemoRelatedSetting(ctx)
	if err != nil {
		return status.Errorf(codes.Internal, "failed to get workspace memo related setting")
	}

	if !workspaceMemoRelatedSetting.ShareTags {
		return status.Errorf(codes.Internal, "Sharing tags is not enabled")
	}

	user, err := s.GetCurrentUser(ctx)
	if err != nil {
		return status.Errorf(codes.Internal, "failed to get current user")
	}

	if user == nil {
		return status.Errorf(codes.Internal, "User need to be set to share tags")
	}

	find.CreatorID = &user.ID
	find.ExcludeComments = true
	find.ExcludeContent = true
	find.ShareTags = true
	find.RowStatus = varPtr(store.Normal)

	request.PageSize = DefaultTagPageSize

	return nil
}

func (s *APIV1Service) buildMemoFindWithFilter(ctx context.Context, find *store.FindMemo, filter string) error {
	if find.PayloadFind == nil {
		find.PayloadFind = &store.FindMemoPayload{}
	}
	if filter != "" {
		filter, err := parseMemoFilter(filter)
		if err != nil {
			return status.Errorf(codes.InvalidArgument, "invalid filter: %v", err)
		}
		if len(filter.ContentSearch) > 0 {
			find.ContentSearch = filter.ContentSearch
		}
		if len(filter.Visibilities) > 0 {
			find.VisibilityList = filter.Visibilities
		}
		if filter.TagSearch != nil {
			if find.PayloadFind == nil {
				find.PayloadFind = &store.FindMemoPayload{}
			}
			find.PayloadFind.TagSearch = filter.TagSearch
		}
		if filter.OrderByPinned {
			find.OrderByPinned = filter.OrderByPinned
		}
		if filter.OrderByTimeAsc {
			find.OrderByTimeAsc = filter.OrderByTimeAsc
		}
		if filter.DisplayTimeAfter != nil {
			workspaceMemoRelatedSetting, err := s.Store.GetWorkspaceMemoRelatedSetting(ctx)
			if err != nil {
				return status.Errorf(codes.Internal, "failed to get workspace memo related setting")
			}
			if workspaceMemoRelatedSetting.DisplayWithUpdateTime {
				find.UpdatedTsAfter = filter.DisplayTimeAfter
			} else {
				find.CreatedTsAfter = filter.DisplayTimeAfter
			}
		}
		if filter.DisplayTimeBefore != nil {
			workspaceMemoRelatedSetting, err := s.Store.GetWorkspaceMemoRelatedSetting(ctx)
			if err != nil {
				return status.Errorf(codes.Internal, "failed to get workspace memo related setting")
			}
			if workspaceMemoRelatedSetting.DisplayWithUpdateTime {
				find.UpdatedTsBefore = filter.DisplayTimeBefore
			} else {
				find.CreatedTsBefore = filter.DisplayTimeBefore
			}
		}
		if filter.Creator != nil {
			userID, err := ExtractUserIDFromName(*filter.Creator)
			if err != nil {
				return errors.Wrap(err, "invalid user name")
			}
			user, err := s.Store.GetUser(ctx, &store.FindUser{
				ID: &userID,
			})
			if err != nil {
				return status.Errorf(codes.Internal, "failed to get user")
			}
			if user == nil {
				return status.Errorf(codes.NotFound, "user not found")
			}
			find.CreatorID = &user.ID
		}
		if filter.RowStatus != nil {
			find.RowStatus = filter.RowStatus
		}
		if filter.Random {
			find.Random = filter.Random
		}
		if filter.Limit != nil {
			find.Limit = filter.Limit
		}
		if filter.IncludeComments {
			find.ExcludeComments = false
		}
		if filter.HasLink {
			find.PayloadFind.HasLink = true
		}
		if filter.HasTaskList {
			find.PayloadFind.HasTaskList = true
		}
		if filter.HasCode {
			find.PayloadFind.HasCode = true
		}
		if filter.HasIncompleteTasks {
			find.PayloadFind.HasIncompleteTasks = true
		}
	}

	user, err := s.GetCurrentUser(ctx)
	if err != nil {
		return status.Errorf(codes.Internal, "failed to get current user")
	}
	// If the user is not authenticated, only public memos are visible.
	if user == nil {
		if filter == "" {
			// If no filter is provided, return an error.
			return status.Errorf(codes.InvalidArgument, "filter is required for unauthenticated user")
		}

		find.VisibilityList = []store.Visibility{store.Public}
	} else if find.CreatorID == nil || *find.CreatorID != user.ID {
		// If creator is not specified or the creator is not the current user, only public and protected memos are visible.
		find.VisibilityList = []store.Visibility{store.Public, store.Protected}
	}

	workspaceMemoRelatedSetting, err := s.Store.GetWorkspaceMemoRelatedSetting(ctx)
	if err != nil {
		return status.Errorf(codes.Internal, "failed to get workspace memo related setting")
	}
	if workspaceMemoRelatedSetting.DisplayWithUpdateTime {
		find.OrderByUpdatedTs = true
	}
	return nil
}

// MemoFilterCELAttributes are the CEL attributes.
var MemoFilterCELAttributes = []cel.EnvOption{
	cel.Variable("content_search", cel.ListType(cel.StringType)),
	cel.Variable("visibilities", cel.ListType(cel.StringType)),
	cel.Variable("tag_search", cel.ListType(cel.StringType)),
	cel.Variable("order_by_pinned", cel.BoolType),
	cel.Variable("order_by_time_asc", cel.BoolType),
	cel.Variable("display_time_before", cel.IntType),
	cel.Variable("display_time_after", cel.IntType),
	cel.Variable("creator", cel.StringType),
	cel.Variable("uid", cel.StringType),
	cel.Variable("row_status", cel.StringType),
	cel.Variable("random", cel.BoolType),
	cel.Variable("limit", cel.IntType),
	cel.Variable("include_comments", cel.BoolType),
	cel.Variable("has_link", cel.BoolType),
	cel.Variable("has_task_list", cel.BoolType),
	cel.Variable("has_code", cel.BoolType),
	cel.Variable("has_incomplete_tasks", cel.BoolType),
}

type MemoFilter struct {
	ContentSearch      []string
	Visibilities       []store.Visibility
	TagSearch          []string
	OrderByPinned      bool
	OrderByTimeAsc     bool
	DisplayTimeBefore  *int64
	DisplayTimeAfter   *int64
	Creator            *string
	RowStatus          *store.RowStatus
	Random             bool
	Limit              *int
	IncludeComments    bool
	HasLink            bool
	HasTaskList        bool
	HasCode            bool
	HasIncompleteTasks bool
}

func parseMemoFilter(expression string) (*MemoFilter, error) {
	e, err := cel.NewEnv(MemoFilterCELAttributes...)
	if err != nil {
		return nil, err
	}
	ast, issues := e.Compile(expression)
	if issues != nil {
		return nil, errors.Errorf("found issue %v", issues)
	}
	filter := &MemoFilter{}
	expr, err := cel.AstToParsedExpr(ast)
	if err != nil {
		return nil, err
	}
	callExpr := expr.GetExpr().GetCallExpr()
	findMemoField(callExpr, filter)
	return filter, nil
}

func findMemoField(callExpr *expr.Expr_Call, filter *MemoFilter) {
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
			} else if idExpr.Name == "tag_search" {
				tagSearch := []string{}
				for _, expr := range callExpr.Args[1].GetListExpr().GetElements() {
					value := expr.GetConstExpr().GetStringValue()
					tagSearch = append(tagSearch, value)
				}
				filter.TagSearch = tagSearch
			} else if idExpr.Name == "order_by_pinned" {
				value := callExpr.Args[1].GetConstExpr().GetBoolValue()
				filter.OrderByPinned = value
			} else if idExpr.Name == "order_by_time_asc" {
				value := callExpr.Args[1].GetConstExpr().GetBoolValue()
				filter.OrderByTimeAsc = value
			} else if idExpr.Name == "display_time_before" {
				displayTimeBefore := callExpr.Args[1].GetConstExpr().GetInt64Value()
				filter.DisplayTimeBefore = &displayTimeBefore
			} else if idExpr.Name == "display_time_after" {
				displayTimeAfter := callExpr.Args[1].GetConstExpr().GetInt64Value()
				filter.DisplayTimeAfter = &displayTimeAfter
			} else if idExpr.Name == "creator" {
				creator := callExpr.Args[1].GetConstExpr().GetStringValue()
				filter.Creator = &creator
			} else if idExpr.Name == "row_status" {
				rowStatus := store.RowStatus(callExpr.Args[1].GetConstExpr().GetStringValue())
				filter.RowStatus = &rowStatus
			} else if idExpr.Name == "random" {
				value := callExpr.Args[1].GetConstExpr().GetBoolValue()
				filter.Random = value
			} else if idExpr.Name == "limit" {
				limit := int(callExpr.Args[1].GetConstExpr().GetInt64Value())
				filter.Limit = &limit
			} else if idExpr.Name == "include_comments" {
				value := callExpr.Args[1].GetConstExpr().GetBoolValue()
				filter.IncludeComments = value
			} else if idExpr.Name == "has_link" {
				value := callExpr.Args[1].GetConstExpr().GetBoolValue()
				filter.HasLink = value
			} else if idExpr.Name == "has_task_list" {
				value := callExpr.Args[1].GetConstExpr().GetBoolValue()
				filter.HasTaskList = value
			} else if idExpr.Name == "has_code" {
				value := callExpr.Args[1].GetConstExpr().GetBoolValue()
				filter.HasCode = value
			} else if idExpr.Name == "has_incomplete_tasks" {
				value := callExpr.Args[1].GetConstExpr().GetBoolValue()
				filter.HasIncompleteTasks = value
			}
			return
		}
	}
	for _, arg := range callExpr.Args {
		callExpr := arg.GetCallExpr()
		if callExpr != nil {
			findMemoField(callExpr, filter)
		}
	}
}
