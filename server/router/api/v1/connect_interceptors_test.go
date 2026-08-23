package v1

import (
	"context"
	"errors"
	"testing"

	"connectrpc.com/connect"
	"google.golang.org/grpc/metadata"
	"google.golang.org/protobuf/types/known/emptypb"
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

	response, err := handler(context.Background(), req)
	if err != nil {
		t.Fatalf("metadata interceptor returned error: %v", err)
	}
	if got := response.Header().Get("Cache-Control"); got != "no-cache, no-store, must-revalidate" {
		t.Fatalf("unexpected Cache-Control header: %q", got)
	}
	if got := response.Header().Get("Pragma"); got != "no-cache" {
		t.Fatalf("unexpected Pragma header: %q", got)
	}
	if got := response.Header().Get("Expires"); got != "0" {
		t.Fatalf("unexpected Expires header: %q", got)
	}
}

func TestNewAuthorizationConnectErrorMapsFailureClass(t *testing.T) {
	unauthenticated := newAuthorizationConnectError(ErrUnauthenticated)
	if got := unauthenticated.Code(); got != connect.CodeUnauthenticated {
		t.Fatalf("unauthenticated error code = %v, want %v", got, connect.CodeUnauthenticated)
	}

	internal := newAuthorizationConnectError(errors.New("database unavailable"))
	if got := internal.Code(); got != connect.CodeInternal {
		t.Fatalf("internal error code = %v, want %v", got, connect.CodeInternal)
	}
	if got := internal.Message(); got != "failed to resolve API access policy" {
		t.Fatalf("internal error message = %q", got)
	}
}
