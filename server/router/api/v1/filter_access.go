package v1

import (
	"context"
	"slices"

	"github.com/pkg/errors"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	filterpkg "github.com/usememos/memos/internal/filter"
	"github.com/usememos/memos/store"
)

func (s *APIV1Service) validateMemoFilterForUser(ctx context.Context, filterText string, user *store.User) error {
	engine, err := filterpkg.DefaultEngine()
	if err != nil {
		return status.Errorf(codes.Internal, "failed to initialize filter: %v", err)
	}
	return s.validateFilterSpaceAccess(ctx, filterText, engine, user)
}

func (s *APIV1Service) validateAttachmentFilterForUser(ctx context.Context, filterText string, user *store.User) error {
	engine, err := filterpkg.DefaultAttachmentEngine()
	if err != nil {
		return status.Errorf(codes.Internal, "failed to initialize filter: %v", err)
	}
	return s.validateFilterSpaceAccess(ctx, filterText, engine, user)
}

func (s *APIV1Service) validateFilterSpaceAccess(ctx context.Context, filterText string, engine *filterpkg.Engine, user *store.User) error {
	program, err := engine.Compile(ctx, filterText)
	if err != nil {
		return status.Errorf(codes.InvalidArgument, "invalid filter: %v", err)
	}
	if _, err := program.Render(filterpkg.RenderOptions{Dialect: s.filterDialect()}); err != nil {
		return status.Errorf(codes.InvalidArgument, "invalid filter: %v", err)
	}

	spaceNames := map[string]struct{}{}
	if err := collectSpaceFilterNames(program.ConditionTree(), false, spaceNames); err != nil {
		return status.Errorf(codes.InvalidArgument, "invalid filter: %v", err)
	}
	if len(spaceNames) == 0 {
		return nil
	}
	if user == nil {
		return status.Error(codes.Unauthenticated, "user not authenticated")
	}

	names := make([]string, 0, len(spaceNames))
	for name := range spaceNames {
		names = append(names, name)
	}
	slices.Sort(names)
	for _, name := range names {
		if _, err := s.resolveWritableSpaceByName(ctx, name, user.ID); err != nil {
			return err
		}
	}
	return nil
}

func collectSpaceFilterNames(condition filterpkg.Condition, negated bool, names map[string]struct{}) error {
	switch condition := condition.(type) {
	case *filterpkg.LogicalCondition:
		if err := collectSpaceFilterNames(condition.Left, negated, names); err != nil {
			return err
		}
		return collectSpaceFilterNames(condition.Right, negated, names)
	case *filterpkg.NotCondition:
		return collectSpaceFilterNames(condition.Expr, true, names)
	case *filterpkg.ComparisonCondition:
		if !valueReferencesSpace(condition.Left) && !valueReferencesSpace(condition.Right) {
			return nil
		}
		field, ok := condition.Left.(*filterpkg.FieldRef)
		if !ok || field.Name != "space" || negated || condition.Operator != filterpkg.CompareEq {
			return errors.New("space only supports a non-negated equality comparison")
		}
		literal, ok := condition.Right.(*filterpkg.LiteralValue)
		if !ok {
			return errors.New("space must be compared with a resource name or null")
		}
		if literal.Value == nil {
			return nil
		}
		name, ok := literal.Value.(string)
		if !ok {
			return errors.New("space must be compared with a resource name or null")
		}
		names[name] = struct{}{}
		return nil
	case *filterpkg.InCondition:
		if valueReferencesSpace(condition.Left) {
			return errors.New("space does not support the in operator")
		}
		for _, value := range condition.Values {
			if valueReferencesSpace(value) {
				return errors.New("space does not support the in operator")
			}
		}
	case *filterpkg.ElementInCondition:
		if condition.Field == "space" || valueReferencesSpace(condition.Element) {
			return errors.New("space does not support the in operator")
		}
	case *filterpkg.FieldPredicateCondition:
		if condition.Field == "space" {
			return errors.New("space must be compared with a resource name or null")
		}
	case *filterpkg.TextMatchCondition:
		if condition.Field == "space" {
			return errors.New("space does not support text matching")
		}
	case *filterpkg.RegexCondition:
		if condition.Field == "space" {
			return errors.New("space does not support regular expressions")
		}
	case *filterpkg.ListComprehensionCondition:
		if condition.Field == "space" {
			return errors.New("space does not support list operations")
		}
	default:
		// Other condition types cannot reference a space.
	}
	return nil
}

func valueReferencesSpace(value filterpkg.ValueExpr) bool {
	switch value := value.(type) {
	case *filterpkg.FieldRef:
		return value.Name == "space"
	case *filterpkg.FunctionValue:
		for _, argument := range value.Args {
			if valueReferencesSpace(argument) {
				return true
			}
		}
	case *filterpkg.FieldAccessorValue:
		return value.Field == "space"
	default:
		// Other value expressions cannot reference a space.
	}
	return false
}
