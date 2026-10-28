package api

import (
	"context"
	"net/http"
	"net/http/httptest"
	"regexp"
	"strings"
	"testing"

	"github.com/grpc-ecosystem/grpc-gateway/v2/runtime"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"google.golang.org/genproto/googleapis/api/annotations"
	"google.golang.org/protobuf/proto"
	"google.golang.org/protobuf/reflect/protoreflect"
	"google.golang.org/protobuf/reflect/protoregistry"
	"gopkg.in/yaml.v3"

	memosproto "github.com/usememos/memos/proto"
	apipb "github.com/usememos/memos/proto/gen/api"
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
			template: "/api/users",
			want:     "/api/users",
		},
		{
			name:     "bare variable",
			template: "/api/shares/{share_token}/memo",
			want:     "/api/shares/{share_token=*}/memo",
		},
		{
			name:     "resource name variable",
			template: "/api/{name=users/*}",
			want:     "/api/{name=users/*}",
		},
		{
			name:     "variable with verb",
			template: "/api/{name=users/*}:getStats",
			want:     "/api/{name=users/*}:getStats",
		},
		{
			name:     "missing leading slash",
			template: "api/users",
			wantErr:  true,
		},
		{
			name:     "unclosed variable",
			template: "/api/{name",
			wantErr:  true,
		},
		{
			name:     "unexpected closing brace",
			template: "/api/name}",
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
		{http.MethodPost, "/api/auth/signin", "/api/auth/signin", "/memos.api.AuthService/SignIn"},
		{http.MethodGet, "/api/instance/profile", "/api/instance/profile", "/memos.api.InstanceService/GetInstanceProfile"},
		{http.MethodPost, "/api/users", "/api/users", "/memos.api.UserService/CreateUser"},
		{http.MethodGet, "/api/users", "/api/users", "/memos.api.UserService/ListUsers"},
		{http.MethodGet, "/api/{name=users/*}", "/api/users/1", "/memos.api.UserService/GetUser"},
		{http.MethodGet, "/api/{parent=users/*}/stats", "/api/users/-/stats", "/memos.api.UserService/ListUserStats"},
		{http.MethodGet, "/api/{parent=users/*}/stats", "/api/users/alice/stats", "/memos.api.UserService/ListUserStats"},
		{http.MethodGet, "/api/{parent=users/*}/views", "/api/users/alice/views", "/memos.api.UserService/ListMemoViews"},
		{http.MethodPost, "/api/{parent=users/*}/views", "/api/users/alice/views", "/memos.api.UserService/CreateMemoView"},
		{http.MethodGet, "/api/{name=users/*/views/*}", "/api/users/alice/views/work", "/memos.api.UserService/GetMemoView"},
		{http.MethodPatch, "/api/{memo_view.name=users/*/views/*}", "/api/users/alice/views/work", "/memos.api.UserService/UpdateMemoView"},
		{http.MethodDelete, "/api/{name=users/*/views/*}", "/api/users/alice/views/work", "/memos.api.UserService/DeleteMemoView"},
		{http.MethodGet, "/api/memos", "/api/memos", "/memos.api.MemoService/ListMemos"},
		{http.MethodGet, "/api/{name=memos/*}", "/api/memos/abc", "/memos.api.MemoService/GetMemo"},
		{http.MethodPost, "/api/memos", "/api/memos", "/memos.api.MemoService/CreateMemo"},
		{http.MethodPost, "/api/spaces", "/api/spaces", "/memos.api.SpaceService/CreateSpace"},
		{http.MethodGet, "/api/{name=spaces/*}", "/api/spaces/team", "/memos.api.SpaceService/GetSpace"},
		{http.MethodDelete, "/api/{name=spaces/*}", "/api/spaces/team", "/memos.api.SpaceService/DeleteSpace"},
		{http.MethodGet, "/api/{name=spaces/*/members/*}", "/api/spaces/team/members/alice", "/memos.api.SpaceService/GetSpaceMember"},
		{
			http.MethodGet,
			"/api/shares/{share_token}/memo",
			"/api/shares/token:with-colon/memo",
			"/memos.api.MemoService/GetSharedMemo",
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
			"/api/instance/profile",
			http.MethodPost,
			"/api/instance/profile",
			"application/x-www-form-urlencoded",
		)
		require.True(t, ok)
		require.Equal(t, "/memos.api.InstanceService/GetInstanceProfile", procedure)
	})

	t.Run("uses matching POST binding", func(t *testing.T) {
		procedure, ok := resolveThroughGateway(
			t,
			resolver,
			http.MethodPost,
			"/api/memos",
			http.MethodPost,
			"/api/memos",
			"application/x-www-form-urlencoded",
		)
		require.True(t, ok)
		require.Equal(t, "/memos.api.MemoService/CreateMemo", procedure)
	})
}

func TestGatewayRouteResolverRequiresMatchedPattern(t *testing.T) {
	resolver, err := newGatewayRouteResolver()
	require.NoError(t, err)

	request := httptest.NewRequest(http.MethodGet, "/api/memos", nil)
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

// TestOpenAPIPathsReachTheirGatewayMethods checks the published contract: every
// path in the generated OpenAPI spec, filled with a sample value per parameter,
// must reach the gateway method its operationId names. The OpenAPI generator
// rewrites path templates, so a binding the gateway cannot match from the
// advertised path (for example a literal inside a variable) fails here.
func TestOpenAPIPathsReachTheirGatewayMethods(t *testing.T) {
	resolver, err := newGatewayRouteResolver()
	require.NoError(t, err)

	// Register the services in production order with stub servers; the
	// middleware records the matched procedure without calling a handler.
	var matched string
	mux := runtime.NewServeMux(runtime.WithMiddlewares(func(runtime.HandlerFunc) runtime.HandlerFunc {
		return func(_ http.ResponseWriter, request *http.Request, _ map[string]string) {
			matched, _ = resolver.resolveRequest(request)
		}
	}))
	ctx := context.Background()
	require.NoError(t, apipb.RegisterInstanceServiceHandlerServer(ctx, mux, apipb.UnimplementedInstanceServiceServer{}))
	require.NoError(t, apipb.RegisterAuthServiceHandlerServer(ctx, mux, apipb.UnimplementedAuthServiceServer{}))
	require.NoError(t, apipb.RegisterUserServiceHandlerServer(ctx, mux, apipb.UnimplementedUserServiceServer{}))
	require.NoError(t, apipb.RegisterMemoServiceHandlerServer(ctx, mux, apipb.UnimplementedMemoServiceServer{}))
	require.NoError(t, apipb.RegisterSpaceServiceHandlerServer(ctx, mux, apipb.UnimplementedSpaceServiceServer{}))
	require.NoError(t, apipb.RegisterAttachmentServiceHandlerServer(ctx, mux, apipb.UnimplementedAttachmentServiceServer{}))
	require.NoError(t, apipb.RegisterAIServiceHandlerServer(ctx, mux, apipb.UnimplementedAIServiceServer{}))
	require.NoError(t, apipb.RegisterIdentityProviderServiceHandlerServer(ctx, mux, apipb.UnimplementedIdentityProviderServiceServer{}))

	var spec struct {
		Paths map[string]map[string]struct {
			OperationID string `yaml:"operationId"`
		} `yaml:"paths"`
	}
	require.NoError(t, yaml.Unmarshal(memosproto.OpenAPIYAML(), &spec))
	require.NotEmpty(t, spec.Paths)

	// The generator renders instance/settings/{setting} as /api/instance/{instance}/*,
	// which no client can call. Fixing it needs a different resource pattern;
	// remove an entry once its path is correct.
	knownBroken := map[string]bool{
		"InstanceService_GetInstanceSetting":    true,
		"InstanceService_UpdateInstanceSetting": true,
	}

	parameter := regexp.MustCompile(`\{[^}]+\}`)
	for path, operations := range spec.Paths {
		for method, operation := range operations {
			if knownBroken[operation.OperationID] {
				continue
			}
			service, rpc, ok := strings.Cut(operation.OperationID, "_")
			require.True(t, ok, "operationId %q", operation.OperationID)

			matched = ""
			request := httptest.NewRequest(strings.ToUpper(method), parameter.ReplaceAllString(path, "sample"), nil)
			mux.ServeHTTP(httptest.NewRecorder(), request)
			assert.Equal(t, "/"+apiPackage+"."+service+"/"+rpc, matched, "%s %s", strings.ToUpper(method), path)
		}
	}
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
		default:
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
		default:
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
	for part := range strings.SplitSeq(subtemplate, "/") {
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
