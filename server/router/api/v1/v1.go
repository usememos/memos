package v1

import (
	"context"
	"fmt"

	"github.com/grpc-ecosystem/grpc-gateway/v2/runtime"
	"github.com/improbable-eng/grpc-web/go/grpcweb"
	"github.com/labstack/echo/v4"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/reflection"

	v1pb "github.com/usememos/memos/proto/gen/api/v1"
	"github.com/usememos/memos/server/profile"
	"github.com/usememos/memos/store"
)

type APIV1Service struct {
	v1pb.UnimplementedWorkspaceServiceServer
	v1pb.UnimplementedWorkspaceSettingServiceServer
	v1pb.UnimplementedAuthServiceServer
	v1pb.UnimplementedUserServiceServer
	v1pb.UnimplementedMemoServiceServer
	v1pb.UnimplementedResourceServiceServer
	v1pb.UnimplementedTagServiceServer
	v1pb.UnimplementedInboxServiceServer
	v1pb.UnimplementedActivityServiceServer
	v1pb.UnimplementedWebhookServiceServer
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
	v1pb.RegisterWorkspaceServiceServer(grpcServer, apiv1Service)
	v1pb.RegisterWorkspaceSettingServiceServer(grpcServer, apiv1Service)
	v1pb.RegisterAuthServiceServer(grpcServer, apiv1Service)
	v1pb.RegisterUserServiceServer(grpcServer, apiv1Service)
	v1pb.RegisterMemoServiceServer(grpcServer, apiv1Service)
	v1pb.RegisterTagServiceServer(grpcServer, apiv1Service)
	v1pb.RegisterResourceServiceServer(grpcServer, apiv1Service)
	v1pb.RegisterInboxServiceServer(grpcServer, apiv1Service)
	v1pb.RegisterActivityServiceServer(grpcServer, apiv1Service)
	v1pb.RegisterWebhookServiceServer(grpcServer, apiv1Service)
	v1pb.RegisterMarkdownServiceServer(grpcServer, apiv1Service)
	v1pb.RegisterIdentityProviderServiceServer(grpcServer, apiv1Service)
	reflection.Register(grpcServer)
	return apiv1Service
}

// RegisterGateway registers the gRPC-Gateway with the given Echo instance.
func (s *APIV1Service) RegisterGateway(ctx context.Context, echoServer *echo.Echo) error {
	// Create a client connection to the gRPC Server we just started.
	// This is where the gRPC-Gateway proxies the requests.
	conn, err := grpc.DialContext(
		ctx,
		fmt.Sprintf(":%d", s.Profile.Port),
		grpc.WithTransportCredentials(insecure.NewCredentials()),
	)
	if err != nil {
		return err
	}

	gwMux := runtime.NewServeMux()
	if err := v1pb.RegisterWorkspaceServiceHandler(context.Background(), gwMux, conn); err != nil {
		return err
	}
	if err := v1pb.RegisterWorkspaceSettingServiceHandler(context.Background(), gwMux, conn); err != nil {
		return err
	}
	if err := v1pb.RegisterAuthServiceHandler(context.Background(), gwMux, conn); err != nil {
		return err
	}
	if err := v1pb.RegisterUserServiceHandler(context.Background(), gwMux, conn); err != nil {
		return err
	}
	if err := v1pb.RegisterMemoServiceHandler(context.Background(), gwMux, conn); err != nil {
		return err
	}
	if err := v1pb.RegisterTagServiceHandler(context.Background(), gwMux, conn); err != nil {
		return err
	}
	if err := v1pb.RegisterResourceServiceHandler(context.Background(), gwMux, conn); err != nil {
		return err
	}
	if err := v1pb.RegisterInboxServiceHandler(context.Background(), gwMux, conn); err != nil {
		return err
	}
	if err := v1pb.RegisterActivityServiceHandler(context.Background(), gwMux, conn); err != nil {
		return err
	}
	if err := v1pb.RegisterWebhookServiceHandler(context.Background(), gwMux, conn); err != nil {
		return err
	}
	if err := v1pb.RegisterMarkdownServiceHandler(context.Background(), gwMux, conn); err != nil {
		return err
	}
	if err := v1pb.RegisterIdentityProviderServiceHandler(context.Background(), gwMux, conn); err != nil {
		return err
	}
	echoServer.Any("/api/v1/*", echo.WrapHandler(gwMux))
	echoServer.Any("/o/*", echo.WrapHandler(gwMux))

	// GRPC web proxy.
	options := []grpcweb.Option{
		grpcweb.WithCorsForRegisteredEndpointsOnly(false),
		grpcweb.WithOriginFunc(func(origin string) bool {
			return true
		}),
	}
	wrappedGrpc := grpcweb.WrapServer(s.grpcServer, options...)
	echoServer.Any("/memos.api.v1.*", echo.WrapHandler(wrappedGrpc))

	return nil
}
