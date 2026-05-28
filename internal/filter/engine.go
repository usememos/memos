package filter

import (
	"context"
	"strings"
	"sync"

	"github.com/google/cel-go/cel"
	"github.com/pkg/errors"
)

// Engine parses CEL filters into a dialect-agnostic condition tree.
type Engine struct {
	schema Schema
	env    *cel.Env
}

// NewEngine builds a new Engine for the provided schema.
func NewEngine(schema Schema) (*Engine, error) {
	env, err := cel.NewEnv(schema.EnvOptions...)
	if err != nil {
		return nil, errors.Wrap(err, "failed to create CEL environment")
	}
	return &Engine{
		schema: schema,
		env:    env,
	}, nil
}

// Program stores a compiled filter condition.
type Program struct {
	schema    Schema
	condition Condition
}

// ConditionTree exposes the underlying condition tree.
func (p *Program) ConditionTree() Condition {
	return p.condition
}

// Compile parses the filter string into an executable program.
func (e *Engine) Compile(_ context.Context, filter string) (*Program, error) {
	if strings.TrimSpace(filter) == "" {
		return nil, errors.New("filter expression is empty")
	}

	ast, issues := e.env.Compile(filter)
	if issues != nil && issues.Err() != nil {
		return nil, errors.Wrap(issues.Err(), "failed to compile filter")
	}
	parsed, err := cel.AstToParsedExpr(ast)
	if err != nil {
		return nil, errors.Wrap(err, "failed to convert AST")
	}

	cond, err := buildCondition(parsed.GetExpr(), e.schema)
	if err != nil {
		return nil, err
	}

	return &Program{
		schema:    e.schema,
		condition: cond,
	}, nil
}

// CompileToStatement compiles and renders the filter in a single step.
func (e *Engine) CompileToStatement(ctx context.Context, filter string, opts RenderOptions) (Statement, error) {
	program, err := e.Compile(ctx, filter)
	if err != nil {
		return Statement{}, err
	}
	return program.Render(opts)
}

// RenderOptions configure SQL rendering.
type RenderOptions struct {
	Dialect           DialectName
	PlaceholderOffset int
	DisableNullChecks bool
}

// Statement contains the rendered SQL fragment and its args.
type Statement struct {
	SQL  string
	Args []any
}

// Render converts the program into a dialect-specific SQL fragment.
func (p *Program) Render(opts RenderOptions) (Statement, error) {
	renderer := newRenderer(p.schema, opts)
	return renderer.Render(p.condition)
}

var (
	defaultOnce           sync.Once
	defaultInst           *Engine
	defaultErr            error
	defaultAttachmentOnce sync.Once
	defaultAttachmentInst *Engine
	defaultAttachmentErr  error
)

// DefaultEngine returns the process-wide memo filter engine.
func DefaultEngine() (*Engine, error) {
	defaultOnce.Do(func() {
		defaultInst, defaultErr = NewEngine(NewSchema())
	})
	return defaultInst, defaultErr
}

// DefaultAttachmentEngine returns the process-wide attachment filter engine.
func DefaultAttachmentEngine() (*Engine, error) {
	defaultAttachmentOnce.Do(func() {
		defaultAttachmentInst, defaultAttachmentErr = NewEngine(NewAttachmentSchema())
	})
	return defaultAttachmentInst, defaultAttachmentErr
}
