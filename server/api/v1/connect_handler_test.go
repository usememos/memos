package v1

import (
	"strings"
	"testing"

	"connectrpc.com/connect"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

func TestConvertGRPCErrorUsesStatusMessage(t *testing.T) {
	const message = "invalid username: must start with a lowercase letter"

	err := convertGRPCError(status.Error(codes.InvalidArgument, message))
	connectErr, ok := err.(*connect.Error)
	if !ok {
		t.Fatalf("convertGRPCError() returned %T, want *connect.Error", err)
	}
	if got := connectErr.Code(); got != connect.CodeInvalidArgument {
		t.Fatalf("convertGRPCError() code = %v, want %v", got, connect.CodeInvalidArgument)
	}
	if got := connectErr.Message(); got != message {
		t.Fatalf("convertGRPCError() message = %q, want %q", got, message)
	}
	if strings.Contains(connectErr.Message(), "rpc error:") {
		t.Fatalf("convertGRPCError() message contains gRPC transport details: %q", connectErr.Message())
	}
}
