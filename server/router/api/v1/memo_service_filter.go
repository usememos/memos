package v1

import (
	"context"

	"github.com/google/cel-go/cel"
	"github.com/pkg/errors"
	exprv1 "google.golang.org/genproto/googleapis/api/expr/v1alpha1"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	"github.com/usememos/memos/store"
)

func (s *APIV1Service) buildMemoFindWithFilter(ctx context.Context, find *store.FindMemo, filter string) error {
	if find.PayloadFind == nil {
		find.PayloadFind = &store.FindMemoPayload{}
	}
	if filter != "" {
		filterExpr, err := parseMemoFilter(filter)
		if err != nil {
			return status.Errorf(codes.InvalidArgument, "invalid filter: %v", err)
		}
		if len(filterExpr.ContentSearch) > 0 {
			find.ContentSearch = filterExpr.ContentSearch
		}
		if filterExpr.TagSearch != nil {
			if find.PayloadFind == nil {
				find.PayloadFind = &store.FindMemoPayload{}
			}
			find.PayloadFind.TagSearch = filterExpr.TagSearch
		}
		if filterExpr.DisplayTimeAfter != nil {
			workspaceMemoRelatedSetting, err := s.Store.GetWorkspaceMemoRelatedSetting(ctx)
			if err != nil {
				return status.Errorf(codes.Internal, "failed to get workspace memo related setting")
			}
			if workspaceMemoRelatedSetting.DisplayWithUpdateTime {
				find.UpdatedTsAfter = filterExpr.DisplayTimeAfter
			} else {
				find.CreatedTsAfter = filterExpr.DisplayTimeAfter
			}
		}
		if filterExpr.DisplayTimeBefore != nil {
			workspaceMemoRelatedSetting, err := s.Store.GetWorkspaceMemoRelatedSetting(ctx)
			if err != nil {
				return status.Errorf(codes.Internal, "failed to get workspace memo related setting")
			}
			if workspaceMemoRelatedSetting.DisplayWithUpdateTime {
				find.UpdatedTsBefore = filterExpr.DisplayTimeBefore
			} else {
				find.CreatedTsBefore = filterExpr.DisplayTimeBefore
			}
		}
		if filterExpr.HasLink {
			find.PayloadFind.HasLink = true
		}
		if filterExpr.HasTaskList {
			find.PayloadFind.HasTaskList = true
		}
		if filterExpr.HasCode {
			find.PayloadFind.HasCode = true
		}
		if filterExpr.HasIncompleteTasks {
			find.PayloadFind.HasIncompleteTasks = true
		}
	}
	return nil
}

// MemoFilterCELAttributes are the CEL attributes.
var MemoFilterCELAttributes = []cel.EnvOption{
	cel.Variable("content_search", cel.ListType(cel.StringType)),
	cel.Variable("tag_search", cel.ListType(cel.StringType)),
	cel.Variable("display_time_before", cel.IntType),
	cel.Variable("display_time_after", cel.IntType),
	cel.Variable("has_link", cel.BoolType),
	cel.Variable("has_task_list", cel.BoolType),
	cel.Variable("has_code", cel.BoolType),
	cel.Variable("has_incomplete_tasks", cel.BoolType),
}

type MemoFilter struct {
	ContentSearch      []string
	TagSearch          []string
	DisplayTimeBefore  *int64
	DisplayTimeAfter   *int64
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
	parsedExpr, err := cel.AstToParsedExpr(ast)
	if err != nil {
		return nil, err
	}
	callExpr := parsedExpr.GetExpr().GetCallExpr()
	findMemoField(callExpr, filter)
	return filter, nil
}

func findMemoField(callExpr *exprv1.Expr_Call, filter *MemoFilter) {
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
			} else if idExpr.Name == "tag_search" {
				tagSearch := []string{}
				for _, expr := range callExpr.Args[1].GetListExpr().GetElements() {
					value := expr.GetConstExpr().GetStringValue()
					tagSearch = append(tagSearch, value)
				}
				filter.TagSearch = tagSearch
			} else if idExpr.Name == "display_time_before" {
				displayTimeBefore := callExpr.Args[1].GetConstExpr().GetInt64Value()
				filter.DisplayTimeBefore = &displayTimeBefore
			} else if idExpr.Name == "display_time_after" {
				displayTimeAfter := callExpr.Args[1].GetConstExpr().GetInt64Value()
				filter.DisplayTimeAfter = &displayTimeAfter
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
