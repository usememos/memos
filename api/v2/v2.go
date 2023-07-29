package v2

import (
	"context"
	"fmt"

	grpcRuntime "github.com/grpc-ecosystem/grpc-gateway/v2/runtime"
	"github.com/labstack/echo/v4"
	apiv2pb "github.com/usememos/memos/proto/gen/api/v2"
	"github.com/usememos/memos/store"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
)

func NewGRPCServer(store *store.Store) *grpc.Server {
	grpcServer := grpc.NewServer()
	apiv2pb.RegisterUserServiceServer(grpcServer, NewUserService(store))
	apiv2pb.RegisterTagServiceServer(grpcServer, NewTagService(store))
	return grpcServer
}

// RegisterGateway registers the gRPC-Gateway with the given Echo instance.
func RegisterGateway(ctx context.Context, e *echo.Echo, grpcServerPort int) error {
	// Create a client connection to the gRPC Server we just started.
	// This is where the gRPC-Gateway proxies the requests.
	conn, err := grpc.DialContext(
		ctx,
		fmt.Sprintf(":%d", grpcServerPort),
		grpc.WithTransportCredentials(insecure.NewCredentials()),
	)
	if err != nil {
		return err
	}

	gwMux := grpcRuntime.NewServeMux()
	if err := apiv2pb.RegisterUserServiceHandler(context.Background(), gwMux, conn); err != nil {
		return err
	}
	if err := apiv2pb.RegisterTagServiceHandler(context.Background(), gwMux, conn); err != nil {
		return err
	}
	e.Any("/api/v2/*", echo.WrapHandler(gwMux))

	return nil
}
