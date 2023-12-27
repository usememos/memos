package v2

import (
	"context"
	"fmt"
	"net"

	"github.com/grpc-ecosystem/grpc-gateway/v2/runtime"
	"github.com/improbable-eng/grpc-web/go/grpcweb"
	"github.com/labstack/echo/v4"
	"github.com/pkg/errors"
	"go.uber.org/zap"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/reflection"

	"github.com/usememos/memos/internal/log"
	apiv2pb "github.com/usememos/memos/proto/gen/api/v2"
	"github.com/usememos/memos/server/profile"
	"github.com/usememos/memos/store"
)

type APIV2Service struct {
	apiv2pb.UnimplementedSystemServiceServer
	apiv2pb.UnimplementedAuthServiceServer
	apiv2pb.UnimplementedUserServiceServer
	apiv2pb.UnimplementedMemoServiceServer
	apiv2pb.UnimplementedResourceServiceServer
	apiv2pb.UnimplementedTagServiceServer
	apiv2pb.UnimplementedInboxServiceServer
	apiv2pb.UnimplementedActivityServiceServer
	apiv2pb.UnimplementedWebhookServiceServer
	apiv2pb.UnimplementedMarkdownServiceServer

	Secret  string
	Profile *profile.Profile
	Store   *store.Store

	grpcServer     *grpc.Server
	grpcServerPort int
}

func NewAPIV2Service(secret string, profile *profile.Profile, store *store.Store, grpcServerPort int) *APIV2Service {
	grpc.EnableTracing = true
	authProvider := NewGRPCAuthInterceptor(store, secret)
	grpcServer := grpc.NewServer(
		grpc.ChainUnaryInterceptor(
			authProvider.AuthenticationInterceptor,
		),
	)
	apiv2Service := &APIV2Service{
		Secret:         secret,
		Profile:        profile,
		Store:          store,
		grpcServer:     grpcServer,
		grpcServerPort: grpcServerPort,
	}

	apiv2pb.RegisterSystemServiceServer(grpcServer, apiv2Service)
	apiv2pb.RegisterAuthServiceServer(grpcServer, apiv2Service)
	apiv2pb.RegisterUserServiceServer(grpcServer, apiv2Service)
	apiv2pb.RegisterMemoServiceServer(grpcServer, apiv2Service)
	apiv2pb.RegisterTagServiceServer(grpcServer, apiv2Service)
	apiv2pb.RegisterResourceServiceServer(grpcServer, apiv2Service)
	apiv2pb.RegisterInboxServiceServer(grpcServer, apiv2Service)
	apiv2pb.RegisterActivityServiceServer(grpcServer, apiv2Service)
	apiv2pb.RegisterWebhookServiceServer(grpcServer, apiv2Service)
	apiv2pb.RegisterMarkdownServiceServer(grpcServer, apiv2Service)
	reflection.Register(grpcServer)

	return apiv2Service
}

func (s *APIV2Service) GetGRPCServer() *grpc.Server {
	return s.grpcServer
}

// RegisterGateway registers the gRPC-Gateway with the given Echo instance.
func (s *APIV2Service) RegisterGateway(ctx context.Context, e *echo.Echo) error {
	// Create a client connection to the gRPC Server we just started.
	// This is where the gRPC-Gateway proxies the requests.
	conn, err := grpc.DialContext(
		ctx,
		fmt.Sprintf(":%d", s.grpcServerPort),
		grpc.WithTransportCredentials(insecure.NewCredentials()),
	)
	if err != nil {
		return err
	}

	gwMux := runtime.NewServeMux()
	if err := apiv2pb.RegisterSystemServiceHandler(context.Background(), gwMux, conn); err != nil {
		return err
	}
	if err := apiv2pb.RegisterAuthServiceHandler(context.Background(), gwMux, conn); err != nil {
		return err
	}
	if err := apiv2pb.RegisterUserServiceHandler(context.Background(), gwMux, conn); err != nil {
		return err
	}
	if err := apiv2pb.RegisterMemoServiceHandler(context.Background(), gwMux, conn); err != nil {
		return err
	}
	if err := apiv2pb.RegisterTagServiceHandler(context.Background(), gwMux, conn); err != nil {
		return err
	}
	if err := apiv2pb.RegisterResourceServiceHandler(context.Background(), gwMux, conn); err != nil {
		return err
	}
	if err := apiv2pb.RegisterInboxServiceHandler(context.Background(), gwMux, conn); err != nil {
		return err
	}
	if err := apiv2pb.RegisterActivityServiceHandler(context.Background(), gwMux, conn); err != nil {
		return err
	}
	if err := apiv2pb.RegisterWebhookServiceHandler(context.Background(), gwMux, conn); err != nil {
		return err
	}
	if err := apiv2pb.RegisterMarkdownServiceHandler(context.Background(), gwMux, conn); err != nil {
		return err
	}
	e.Any("/api/v2/*", echo.WrapHandler(gwMux))

	// GRPC web proxy.
	options := []grpcweb.Option{
		grpcweb.WithCorsForRegisteredEndpointsOnly(false),
		grpcweb.WithOriginFunc(func(origin string) bool {
			return true
		}),
	}
	wrappedGrpc := grpcweb.WrapServer(s.grpcServer, options...)
	e.Any("/memos.api.v2.*", echo.WrapHandler(wrappedGrpc))

	// Start gRPC server.
	listen, err := net.Listen("tcp", fmt.Sprintf("%s:%d", s.Profile.Addr, s.grpcServerPort))
	if err != nil {
		return errors.Wrap(err, "failed to start gRPC server")
	}
	go func() {
		if err := s.grpcServer.Serve(listen); err != nil {
			log.Error("grpc server listen error", zap.Error(err))
		}
	}()

	return nil
}
