package v1

import (
	"context"

	"connectrpc.com/connect"
	"google.golang.org/grpc"
	"google.golang.org/grpc/metadata"
)

// headerCarrierKey is the context key for storing headers to be set in the response.
type headerCarrierKey struct{}

// HeaderCarrier stores headers that need to be set in the response.
//
// Problem: The codebase supports two protocols simultaneously:
//   - Native gRPC: Uses grpc.SetHeader() to set response headers
//   - Connect-RPC: Uses connect.Response.Header().Set() to set response headers
//
// Solution: HeaderCarrier provides a protocol-agnostic way to set headers.
//   - Service methods call SetResponseHeader() regardless of protocol
//   - For gRPC requests: SetResponseHeader uses grpc.SetHeader directly
//   - For Connect requests: SetResponseHeader stores headers in HeaderCarrier
//   - Connect wrappers extract headers from HeaderCarrier and apply to response
//
// This allows service methods to work with both protocols without knowing which one is being used.
type HeaderCarrier struct {
	headers map[string]string
}

// newHeaderCarrier creates a new header carrier.
func newHeaderCarrier() *HeaderCarrier {
	return &HeaderCarrier{
		headers: make(map[string]string),
	}
}

// Set adds a header to the carrier.
func (h *HeaderCarrier) Set(key, value string) {
	h.headers[key] = value
}

// Get retrieves a header from the carrier.
func (h *HeaderCarrier) Get(key string) string {
	return h.headers[key]
}

// All returns all headers.
func (h *HeaderCarrier) All() map[string]string {
	return h.headers
}

// WithHeaderCarrier adds a header carrier to the context.
func WithHeaderCarrier(ctx context.Context) context.Context {
	return context.WithValue(ctx, headerCarrierKey{}, newHeaderCarrier())
}

// GetHeaderCarrier retrieves the header carrier from the context.
// Returns nil if no carrier is present.
func GetHeaderCarrier(ctx context.Context) *HeaderCarrier {
	if carrier, ok := ctx.Value(headerCarrierKey{}).(*HeaderCarrier); ok {
		return carrier
	}
	return nil
}

// SetResponseHeader sets a header in the response.
//
// This function works for both gRPC and Connect protocols:
//   - For gRPC: Uses grpc.SetHeader to set headers in gRPC metadata
//   - For Connect: Stores in HeaderCarrier for Connect wrapper to apply later
//
// The protocol is automatically detected based on whether a HeaderCarrier
// exists in the context (injected by Connect wrappers).
func SetResponseHeader(ctx context.Context, key, value string) error {
	// Try Connect first (check if we have a header carrier)
	if carrier := GetHeaderCarrier(ctx); carrier != nil {
		carrier.Set(key, value)
		return nil
	}

	// Fall back to gRPC
	return grpc.SetHeader(ctx, metadata.New(map[string]string{
		key: value,
	}))
}

// connectWithHeaderCarrier is a helper for Connect service wrappers that need to set response headers.
//
// It injects a HeaderCarrier into the context, calls the service method,
// and applies any headers from the carrier to the Connect response.
//
// The generic parameter T is the non-pointer protobuf message type (e.g., v1pb.CreateSessionResponse),
// while fn returns *T (the pointer type) as is standard for protobuf messages.
//
// Usage in Connect wrappers:
//
//	func (s *ConnectServiceHandler) CreateSession(ctx context.Context, req *connect.Request[v1pb.CreateSessionRequest]) (*connect.Response[v1pb.CreateSessionResponse], error) {
//	    return connectWithHeaderCarrier(ctx, func(ctx context.Context) (*v1pb.CreateSessionResponse, error) {
//	        return s.APIV1Service.CreateSession(ctx, req.Msg)
//	    })
//	}
func connectWithHeaderCarrier[T any](ctx context.Context, fn func(context.Context) (*T, error)) (*connect.Response[T], error) {
	// Inject header carrier for Connect protocol
	ctx = WithHeaderCarrier(ctx)

	// Call the service method
	resp, err := fn(ctx)
	if err != nil {
		return nil, convertGRPCError(err)
	}

	// Create Connect response
	connectResp := connect.NewResponse(resp)

	// Apply any headers set via the header carrier
	if carrier := GetHeaderCarrier(ctx); carrier != nil {
		for key, value := range carrier.All() {
			connectResp.Header().Set(key, value)
		}
	}

	return connectResp, nil
}
