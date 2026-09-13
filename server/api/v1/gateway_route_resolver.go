package v1

import (
	"net/http"
	"strings"

	"github.com/grpc-ecosystem/grpc-gateway/v2/runtime"
	"github.com/pkg/errors"
	"google.golang.org/genproto/googleapis/api/annotations"
	"google.golang.org/protobuf/proto"
	"google.golang.org/protobuf/reflect/protoreflect"
	"google.golang.org/protobuf/reflect/protoregistry"
)

// apiPackage is the proto package whose HTTP bindings the gateway serves.
const apiPackage = "memos.api.v1"

type gatewayRouteKey struct {
	httpMethod string
	pattern    string
}

// gatewayRouteResolver maps the HTTP pattern already matched by grpc-gateway
// back to the gRPC procedure that owns the binding.
//
// runtime.RPCMethod is not available to middleware because the generated
// handler sets it after middleware runs. The ServeMux does, however, put the
// exact matched runtime.Pattern in the request context before invoking the
// middleware. Using that pattern avoids independently reimplementing the
// gateway's path matching, escaping, verb, and route-ordering semantics.
type gatewayRouteResolver struct {
	procedures map[gatewayRouteKey]string
}

// newGatewayRouteResolver builds a lookup table from the registered protos.
func newGatewayRouteResolver() (*gatewayRouteResolver, error) {
	resolver := &gatewayRouteResolver{procedures: map[gatewayRouteKey]string{}}

	var rangeErr error
	protoregistry.GlobalFiles.RangeFiles(func(fd protoreflect.FileDescriptor) bool {
		if string(fd.Package()) != apiPackage {
			return true
		}
		services := fd.Services()
		for i := range services.Len() {
			service := services.Get(i)
			methods := service.Methods()
			for j := range methods.Len() {
				method := methods.Get(j)
				rule, ok := proto.GetExtension(method.Options(), annotations.E_Http).(*annotations.HttpRule)
				if !ok || rule == nil {
					continue
				}
				procedure := "/" + string(service.FullName()) + "/" + string(method.Name())
				if err := resolver.addRule(procedure, rule); err != nil {
					rangeErr = err
					return false
				}
			}
		}
		return true
	})
	if rangeErr != nil {
		return nil, rangeErr
	}
	if len(resolver.procedures) == 0 {
		return nil, errors.Errorf("no HTTP bindings found for proto package %s", apiPackage)
	}
	return resolver, nil
}

// addRule records a rule and each of its additional bindings.
func (r *gatewayRouteResolver) addRule(procedure string, rule *annotations.HttpRule) error {
	if err := r.addBinding(procedure, rule); err != nil {
		return err
	}
	for _, binding := range rule.GetAdditionalBindings() {
		if err := r.addBinding(procedure, binding); err != nil {
			return err
		}
	}
	return nil
}

func (r *gatewayRouteResolver) addBinding(procedure string, rule *annotations.HttpRule) error {
	httpMethod, template := httpRuleMethodAndTemplate(rule)
	if httpMethod == "" || template == "" {
		return nil
	}

	pattern, err := canonicalGatewayPattern(template)
	if err != nil {
		return errors.Wrapf(err, "failed to canonicalize HTTP template %q for %s", template, procedure)
	}
	key := gatewayRouteKey{httpMethod: httpMethod, pattern: pattern}
	if existing, ok := r.procedures[key]; ok && existing != procedure {
		return errors.Errorf("%s %s is bound to both %s and %s", httpMethod, pattern, existing, procedure)
	}
	r.procedures[key] = procedure
	return nil
}

func (r *gatewayRouteResolver) resolve(httpMethod, pattern string) (string, bool) {
	procedure, ok := r.procedures[gatewayRouteKey{httpMethod: httpMethod, pattern: pattern}]
	return procedure, ok
}

// resolveRequest returns the procedure for the handler grpc-gateway selected.
func (r *gatewayRouteResolver) resolveRequest(request *http.Request) (string, bool) {
	pattern, ok := runtime.HTTPPattern(request.Context())
	if !ok {
		return "", false
	}

	matchedPattern := pattern.String()
	if procedure, ok := r.resolve(request.Method, matchedPattern); ok {
		return procedure, true
	}

	// grpc-gateway supports submitting a GET binding as a form POST when no
	// POST binding matched the path. The selected pattern is still the GET
	// handler's pattern, while request.Method remains POST.
	if request.Method == http.MethodPost && request.Header.Get("Content-Type") == "application/x-www-form-urlencoded" {
		return r.resolve(http.MethodGet, matchedPattern)
	}
	return "", false
}

// httpRuleMethodAndTemplate extracts the HTTP method and path template from a rule.
func httpRuleMethodAndTemplate(rule *annotations.HttpRule) (string, string) {
	switch pattern := rule.GetPattern().(type) {
	case *annotations.HttpRule_Get:
		return http.MethodGet, pattern.Get
	case *annotations.HttpRule_Post:
		return http.MethodPost, pattern.Post
	case *annotations.HttpRule_Put:
		return http.MethodPut, pattern.Put
	case *annotations.HttpRule_Patch:
		return http.MethodPatch, pattern.Patch
	case *annotations.HttpRule_Delete:
		return http.MethodDelete, pattern.Delete
	case *annotations.HttpRule_Custom:
		return strings.ToUpper(pattern.Custom.GetKind()), pattern.Custom.GetPath()
	default:
		return "", ""
	}
}

// canonicalGatewayPattern converts a google.api.http template to the normalized
// form returned by runtime.Pattern.String. In particular, grpc-gateway expands
// a bare "{field}" variable to "{field=*}".
func canonicalGatewayPattern(template string) (string, error) {
	if !strings.HasPrefix(template, "/") {
		return "", errors.New("template must start with '/'")
	}

	var builder strings.Builder
	for index := 0; index < len(template); {
		switch template[index] {
		case '{':
			relativeEnd := strings.IndexByte(template[index+1:], '}')
			if relativeEnd < 0 {
				return "", errors.New("unclosed variable")
			}
			end := index + 1 + relativeEnd
			variable := template[index+1 : end]
			if variable == "" || strings.ContainsAny(variable, "{}") {
				return "", errors.Errorf("invalid variable %q", variable)
			}
			field, subtemplate, hasSubtemplate := strings.Cut(variable, "=")
			if field == "" || (hasSubtemplate && subtemplate == "") {
				return "", errors.Errorf("invalid variable %q", variable)
			}
			if !hasSubtemplate {
				variable += "=*"
			}
			builder.WriteByte('{')
			builder.WriteString(variable)
			builder.WriteByte('}')
			index = end + 1
		case '}':
			return "", errors.New("unexpected closing brace")
		default:
			builder.WriteByte(template[index])
			index++
		}
	}
	return builder.String(), nil
}
