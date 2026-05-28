package v1

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"connectrpc.com/connect"
	"github.com/labstack/echo/v5"
	"google.golang.org/grpc/metadata"
	"google.golang.org/protobuf/types/known/emptypb"

	"github.com/usememos/memos/internal/profile"
)

func TestMetadataInterceptorForwardsSecurityHeaders(t *testing.T) {
	interceptor := NewMetadataInterceptor()
	req := connect.NewRequest(&emptypb.Empty{})
	req.Header().Set("Origin", "https://memos.example")
	req.Header().Set("X-Forwarded-Proto", "https")
	req.Header().Set("Forwarded", "for=203.0.113.1;proto=https")

	handler := interceptor.WrapUnary(func(ctx context.Context, _ connect.AnyRequest) (connect.AnyResponse, error) {
		md, ok := metadata.FromIncomingContext(ctx)
		if !ok {
			t.Fatal("expected metadata in context")
		}
		if got := md.Get("origin"); len(got) != 1 || got[0] != "https://memos.example" {
			t.Fatalf("unexpected origin metadata: %v", got)
		}
		if got := md.Get("x-forwarded-proto"); len(got) != 1 || got[0] != "https" {
			t.Fatalf("unexpected x-forwarded-proto metadata: %v", got)
		}
		if got := md.Get("forwarded"); len(got) != 1 || got[0] != "for=203.0.113.1;proto=https" {
			t.Fatalf("unexpected forwarded metadata: %v", got)
		}
		return connect.NewResponse(&emptypb.Empty{}), nil
	})

	if _, err := handler(context.Background(), req); err != nil {
		t.Fatalf("metadata interceptor returned error: %v", err)
	}
}

func TestAllowedConnectOrigin(t *testing.T) {
	service := &APIV1Service{
		Profile: &profile.Profile{InstanceURL: "https://memos.example"},
	}
	e := echo.New()
	req := httptest.NewRequest(http.MethodOptions, "http://localhost/memos.api.v1.AuthService/SignIn", nil)
	req.Host = "localhost"
	rec := httptest.NewRecorder()
	ctx := e.NewContext(req, rec)

	if !service.isAllowedConnectOrigin(ctx, "http://localhost") {
		t.Fatal("expected same host origin to be allowed")
	}
	if !service.isAllowedConnectOrigin(ctx, "https://memos.example") {
		t.Fatal("expected instance URL origin to be allowed")
	}
	if service.isAllowedConnectOrigin(ctx, "https://evil.example") {
		t.Fatal("expected unknown origin to be denied")
	}
}
