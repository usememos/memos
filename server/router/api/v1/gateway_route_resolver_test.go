package v1

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/grpc-ecosystem/grpc-gateway/v2/runtime"
	"github.com/stretchr/testify/require"
	"google.golang.org/genproto/googleapis/api/annotations"
	"google.golang.org/protobuf/proto"
	"google.golang.org/protobuf/reflect/protoreflect"
	"google.golang.org/protobuf/reflect/protoregistry"
)

func TestCanonicalGatewayPattern(t *testing.T) {
	tests := []struct {
		name     string
		template string
		want     string
		wantErr  bool
	}{
		{
			name:     "literal",
			template: "/api/v1/users",
			want:     "/api/v1/users",
		},
		{
			name:     "bare variable",
			template: "/api/v1/shares/{share_token}/memo",
			want:     "/api/v1/shares/{share_token=*}/memo",
		},
		{
			name:     "resource name variable",
			template: "/api/v1/{name=users/*}",
			want:     "/api/v1/{name=users/*}",
		},
		{
			name:     "variable with verb",
			template: "/api/v1/{name=users/*}:getStats",
			want:     "/api/v1/{name=users/*}:getStats",
		},
		{
			name:     "missing leading slash",
			template: "api/v1/users",
			wantErr:  true,
		},
		{
			name:     "unclosed variable",
			template: "/api/v1/{name",
			wantErr:  true,
		},
		{
			name:     "unexpected closing brace",
			template: "/api/v1/name}",
			wantErr:  true,
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			got, err := canonicalGatewayPattern(test.template)
			if test.wantErr {
				require.Error(t, err)
				return
			}
			require.NoError(t, err)
			require.Equal(t, test.want, got)
		})
	}
}

// TestGatewayRouteResolverResolvesKnownRoutes pins the procedures that carry
// access-control decisions. The request is dispatched through a real ServeMux
// so the resolver consumes the exact runtime.Pattern seen by middleware.
func TestGatewayRouteResolverResolvesKnownRoutes(t *testing.T) {
	resolver, err := newGatewayRouteResolver()
	require.NoError(t, err)

	tests := []struct {
		httpMethod string
		template   string
		path       string
		procedure  string
	}{
		{http.MethodPost, "/api/v1/auth/signin", "/api/v1/auth/signin", "/memos.api.v1.AuthService/SignIn"},
		{http.MethodGet, "/api/v1/instance/profile", "/api/v1/instance/profile", "/memos.api.v1.InstanceService/GetInstanceProfile"},
		{http.MethodPost, "/api/v1/users", "/api/v1/users", "/memos.api.v1.UserService/CreateUser"},
		{http.MethodGet, "/api/v1/users", "/api/v1/users", "/memos.api.v1.UserService/ListUsers"},
		{http.MethodGet, "/api/v1/{name=users/*}", "/api/v1/users/1", "/memos.api.v1.UserService/GetUser"},
		{http.MethodGet, "/api/v1/memos", "/api/v1/memos", "/memos.api.v1.MemoService/ListMemos"},
		{http.MethodGet, "/api/v1/{name=memos/*}", "/api/v1/memos/abc", "/memos.api.v1.MemoService/GetMemo"},
		{http.MethodPost, "/api/v1/memos", "/api/v1/memos", "/memos.api.v1.MemoService/CreateMemo"},
		{
			http.MethodGet,
			"/api/v1/shares/{share_token}/memo",
			"/api/v1/shares/token:with-colon/memo",
			"/memos.api.v1.MemoService/GetSharedMemo",
		},
	}

	for _, test := range tests {
		t.Run(test.httpMethod+" "+test.path, func(t *testing.T) {
			procedure, ok := resolveThroughGateway(t, resolver, test.httpMethod, test.template, test.httpMethod, test.path, "")
			require.True(t, ok)
			require.Equal(t, test.procedure, procedure)
		})
	}
}

func TestGatewayRouteResolverResolvesFormPostFallback(t *testing.T) {
	resolver, err := newGatewayRouteResolver()
	require.NoError(t, err)

	t.Run("falls back to public GET binding", func(t *testing.T) {
		procedure, ok := resolveThroughGateway(
			t,
			resolver,
			http.MethodGet,
			"/api/v1/instance/profile",
			http.MethodPost,
			"/api/v1/instance/profile",
			"application/x-www-form-urlencoded",
		)
		require.True(t, ok)
		require.Equal(t, "/memos.api.v1.InstanceService/GetInstanceProfile", procedure)
	})

	t.Run("uses matching POST binding", func(t *testing.T) {
		procedure, ok := resolveThroughGateway(
			t,
			resolver,
			http.MethodPost,
			"/api/v1/memos",
			http.MethodPost,
			"/api/v1/memos",
			"application/x-www-form-urlencoded",
		)
		require.True(t, ok)
		require.Equal(t, "/memos.api.v1.MemoService/CreateMemo", procedure)
	})
}

func TestGatewayRouteResolverRequiresMatchedPattern(t *testing.T) {
	resolver, err := newGatewayRouteResolver()
	require.NoError(t, err)

	request := httptest.NewRequest(http.MethodGet, "/api/v1/memos", nil)
	_, ok := resolver.resolveRequest(request)
	require.False(t, ok)
}

// TestGatewayRouteResolverCoversEveryBinding walks every google.api.http binding
// in the API package, dispatches a concrete request through grpc-gateway, and
// requires the matched pattern to map back to the same procedure.
func TestGatewayRouteResolverCoversEveryBinding(t *testing.T) {
	resolver, err := newGatewayRouteResolver()
	require.NoError(t, err)

	checked := 0
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

				for _, binding := range append([]*annotations.HttpRule{rule}, rule.GetAdditionalBindings()...) {
					httpMethod, template := httpRuleMethodAndTemplate(binding)
					if httpMethod == "" || template == "" {
						continue
					}

					path := synthesizeGatewayPath(template)
					resolved, found := resolveThroughGateway(t, resolver, httpMethod, template, httpMethod, path, "")
					require.True(t, found, "%s %s (from %q) should resolve", httpMethod, path, template)
					require.Equal(t, procedure, resolved,
						"%s %s (from template %q) resolved to the wrong procedure", httpMethod, path, template)
					checked++
				}
			}
		}
		return true
	})

	require.Positive(t, checked, "should have checked at least one binding")
	t.Logf("verified %d HTTP bindings", checked)
}

func resolveThroughGateway(
	t *testing.T,
	resolver *gatewayRouteResolver,
	bindingMethod string,
	template string,
	requestMethod string,
	path string,
	contentType string,
) (string, bool) {
	t.Helper()

	var (
		called    bool
		procedure string
		resolved  bool
	)
	mux := runtime.NewServeMux()
	require.NoError(t, mux.HandlePath(bindingMethod, template, func(_ http.ResponseWriter, request *http.Request, _ map[string]string) {
		called = true
		procedure, resolved = resolver.resolveRequest(request)
	}))

	request := httptest.NewRequest(requestMethod, path, nil)
	if contentType != "" {
		request.Header.Set("Content-Type", contentType)
	}
	mux.ServeHTTP(httptest.NewRecorder(), request)
	require.True(t, called, "grpc-gateway should match %s %s against %q", requestMethod, path, template)
	return procedure, resolved
}

// synthesizeGatewayPath turns a path template into a concrete path by replacing
// variables and wildcards with placeholder segments.
func synthesizeGatewayPath(template string) string {
	path, verb := splitGatewayTemplateVerb(template)

	segments := splitGatewayPathSegments(path)
	built := make([]string, 0, len(segments))
	for _, segment := range segments {
		switch {
		case segment == "*":
			built = append(built, "one")
		case segment == "**":
			built = append(built, "one", "two")
		case strings.HasPrefix(segment, "{") && strings.HasSuffix(segment, "}"):
			built = append(built, synthesizeGatewayVariable(segment)...)
		default:
			built = append(built, segment)
		}
	}

	result := "/" + strings.Join(built, "/")
	if verb != "" {
		result += ":" + verb
	}
	return result
}

func splitGatewayPathSegments(path string) []string {
	trimmed := strings.TrimPrefix(path, "/")
	if trimmed == "" {
		return nil
	}

	var segments []string
	depth, start := 0, 0
	for index := 0; index < len(trimmed); index++ {
		switch trimmed[index] {
		case '{':
			depth++
		case '}':
			depth--
		case '/':
			if depth == 0 {
				segments = append(segments, trimmed[start:index])
				start = index + 1
			}
		}
	}
	return append(segments, trimmed[start:])
}

func splitGatewayTemplateVerb(template string) (string, string) {
	depth := 0
	for index := len(template) - 1; index >= 0; index-- {
		switch template[index] {
		case '}':
			depth++
		case '{':
			depth--
		case ':':
			if depth == 0 {
				return template[:index], template[index+1:]
			}
		}
	}
	return template, ""
}

func synthesizeGatewayVariable(segment string) []string {
	inner := strings.TrimSuffix(strings.TrimPrefix(segment, "{"), "}")
	_, subtemplate, hasSubtemplate := strings.Cut(inner, "=")
	if !hasSubtemplate || subtemplate == "" || subtemplate == "*" {
		return []string{"one"}
	}

	var built []string
	for _, part := range strings.Split(subtemplate, "/") {
		switch part {
		case "*":
			built = append(built, "one")
		case "**":
			built = append(built, "one", "two")
		default:
			built = append(built, part)
		}
	}
	return built
}
