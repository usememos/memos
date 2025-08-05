package v1

import (
	"context"
	"fmt"
	"math"

	"github.com/grpc-ecosystem/grpc-gateway/v2/runtime"
	"github.com/improbable-eng/grpc-web/go/grpcweb"
	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/health/grpc_health_v1"
	"google.golang.org/grpc/reflection"

	"github.com/usememos/memos/internal/profile"
	v1pb "github.com/usememos/memos/proto/gen/api/v1"
	"github.com/usememos/memos/store"
)

type APIV1Service struct {
	grpc_health_v1.UnimplementedHealthServer

	v1pb.UnimplementedWorkspaceServiceServer
	v1pb.UnimplementedAuthServiceServer
	v1pb.UnimplementedUserServiceServer
	v1pb.UnimplementedMemoServiceServer
	v1pb.UnimplementedAttachmentServiceServer
	v1pb.UnimplementedShortcutServiceServer
	v1pb.UnimplementedInboxServiceServer
	v1pb.UnimplementedActivityServiceServer
	v1pb.UnimplementedMarkdownServiceServer
	v1pb.UnimplementedIdentityProviderServiceServer

	Secret  string
	Profile *profile.Profile
	Store   *store.Store

	grpcServer *grpc.Server
}

func NewAPIV1Service(secret string, profile *profile.Profile, store *store.Store, grpcServer *grpc.Server) *APIV1Service {
	grpc.EnableTracing = true
	apiv1Service := &APIV1Service{
		Secret:     secret,
		Profile:    profile,
		Store:      store,
		grpcServer: grpcServer,
	}
	grpc_health_v1.RegisterHealthServer(grpcServer, apiv1Service)
	v1pb.RegisterWorkspaceServiceServer(grpcServer, apiv1Service)
	v1pb.RegisterAuthServiceServer(grpcServer, apiv1Service)
	v1pb.RegisterUserServiceServer(grpcServer, apiv1Service)
	v1pb.RegisterMemoServiceServer(grpcServer, apiv1Service)
	v1pb.RegisterAttachmentServiceServer(grpcServer, apiv1Service)
	v1pb.RegisterShortcutServiceServer(grpcServer, apiv1Service)
	v1pb.RegisterInboxServiceServer(grpcServer, apiv1Service)
	v1pb.RegisterActivityServiceServer(grpcServer, apiv1Service)
	v1pb.RegisterMarkdownServiceServer(grpcServer, apiv1Service)
	v1pb.RegisterIdentityProviderServiceServer(grpcServer, apiv1Service)
	reflection.Register(grpcServer)
	return apiv1Service
}

// RegisterGateway registers the gRPC-Gateway with the given Echo instance.
func (s *APIV1Service) RegisterGateway(ctx context.Context, echoServer *echo.Echo) error {
	var target string
	if len(s.Profile.UNIXSock) == 0 {
		addr := s.Profile.Addr
		if addr == "" {
			addr = "localhost"
		}
		target = fmt.Sprintf("%s:%d", addr, s.Profile.Port)
	} else {
		target = fmt.Sprintf("unix:%s", s.Profile.UNIXSock)
	}
	conn, err := grpc.NewClient(
		target,
		grpc.WithTransportCredentials(insecure.NewCredentials()),
		grpc.WithDefaultCallOptions(grpc.MaxCallRecvMsgSize(math.MaxInt32)),
	)
	if err != nil {
		return err
	}

	gwMux := runtime.NewServeMux()
	if err := v1pb.RegisterWorkspaceServiceHandler(ctx, gwMux, conn); err != nil {
		return err
	}
	if err := v1pb.RegisterAuthServiceHandler(ctx, gwMux, conn); err != nil {
		return err
	}
	if err := v1pb.RegisterUserServiceHandler(ctx, gwMux, conn); err != nil {
		return err
	}
	if err := v1pb.RegisterMemoServiceHandler(ctx, gwMux, conn); err != nil {
		return err
	}
	if err := v1pb.RegisterAttachmentServiceHandler(ctx, gwMux, conn); err != nil {
		return err
	}
	if err := v1pb.RegisterShortcutServiceHandler(ctx, gwMux, conn); err != nil {
		return err
	}
	if err := v1pb.RegisterInboxServiceHandler(ctx, gwMux, conn); err != nil {
		return err
	}
	if err := v1pb.RegisterActivityServiceHandler(ctx, gwMux, conn); err != nil {
		return err
	}
	if err := v1pb.RegisterMarkdownServiceHandler(ctx, gwMux, conn); err != nil {
		return err
	}
	if err := v1pb.RegisterIdentityProviderServiceHandler(ctx, gwMux, conn); err != nil {
		return err
	}
	gwGroup := echoServer.Group("")
	gwGroup.Use(middleware.CORS())
	handler := echo.WrapHandler(gwMux)

	gwGroup.Any("/api/v1/*", handler)
	gwGroup.Any("/file/*", handler)

	// GRPC web proxy.
	options := []grpcweb.Option{
		grpcweb.WithCorsForRegisteredEndpointsOnly(false),
		grpcweb.WithOriginFunc(func(_ string) bool {
			return true
		}),
	}
	wrappedGrpc := grpcweb.WrapServer(s.grpcServer, options...)
	echoServer.Any("/memos.api.v1.*", echo.WrapHandler(wrappedGrpc))

	return nil
}
