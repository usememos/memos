package v2

import (
	"context"
	"fmt"

	grpcRuntime "github.com/grpc-ecosystem/grpc-gateway/v2/runtime"
	"github.com/labstack/echo/v4"
	apiv2pb "github.com/usememos/memos/proto/gen/api/v2"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
)

// RegisterGateway registers the gRPC-Gateway with the given Echo instance.
func RegisterGateway(ctx context.Context, e *echo.Echo, grpcServerPort int) {
	// Create a client connection to the gRPC Server we just started.
	// This is where the gRPC-Gateway proxies the requests.
	conn, err := grpc.DialContext(
		ctx,
		fmt.Sprintf(":%d", grpcServerPort),
		grpc.WithTransportCredentials(insecure.NewCredentials()),
	)
	if err != nil {
		panic(err)
	}

	gwMux := grpcRuntime.NewServeMux()
	err = apiv2pb.RegisterTagServiceHandler(context.Background(), gwMux, conn)
	if err != nil {
		panic(err)
	}
	e.Any("/api/v2/*", echo.WrapHandler(gwMux))
}
