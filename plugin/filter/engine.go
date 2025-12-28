package filter

import (
	"context"
	"fmt"
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

	filter = normalizeLegacyFilter(filter)

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

func normalizeLegacyFilter(expr string) string {
	expr = rewriteNumericLogicalOperand(expr, "&&")
	expr = rewriteNumericLogicalOperand(expr, "||")
	return expr
}

func rewriteNumericLogicalOperand(expr, op string) string {
	var builder strings.Builder
	n := len(expr)
	i := 0
	var inQuote rune

	for i < n {
		ch := expr[i]

		if inQuote != 0 {
			builder.WriteByte(ch)
			if ch == '\\' && i+1 < n {
				builder.WriteByte(expr[i+1])
				i += 2
				continue
			}
			if ch == byte(inQuote) {
				inQuote = 0
			}
			i++
			continue
		}

		if ch == '\'' || ch == '"' {
			inQuote = rune(ch)
			builder.WriteByte(ch)
			i++
			continue
		}

		if strings.HasPrefix(expr[i:], op) {
			builder.WriteString(op)
			i += len(op)

			// Preserve whitespace following the operator.
			wsStart := i
			for i < n && (expr[i] == ' ' || expr[i] == '\t') {
				i++
			}
			builder.WriteString(expr[wsStart:i])

			signStart := i
			if i < n && (expr[i] == '+' || expr[i] == '-') {
				i++
			}
			for i < n && expr[i] >= '0' && expr[i] <= '9' {
				i++
			}
			if i > signStart {
				numLiteral := expr[signStart:i]
				builder.WriteString(fmt.Sprintf("(%s != 0)", numLiteral))
			} else {
				builder.WriteString(expr[signStart:i])
			}
			continue
		}

		builder.WriteByte(ch)
		i++
	}

	return builder.String()
}
