package api

import (
	"context"
	"errors"

	"connectrpc.com/connect"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	apipb "github.com/usememos/memos/proto/gen/api"
	"github.com/usememos/memos/store"
)

func encryptionError(err error) error {
	if errors.Is(err, store.ErrEncryptionConflict) {
		return status.Errorf(codes.Aborted, "%s", err.Error())
	}
	if errors.Is(err, store.ErrEncryptionPolicy) {
		return status.Errorf(codes.InvalidArgument, "%s", err.Error())
	}
	return status.Errorf(codes.Internal, "encryption vault operation failed")
}

// GetEncryptionVault returns only the authenticated caller's wrapped keys.
func (s *APIService) GetEncryptionVault(ctx context.Context, _ *apipb.GetEncryptionVaultRequest) (*apipb.EncryptionVault, error) {
	u, err := s.fetchCurrentUser(ctx)
	if err != nil {
		return nil, err
	}
	if u == nil {
		return nil, status.Errorf(codes.Unauthenticated, "sign in required")
	}
	data, err := s.Store.GetEncryptionVault(ctx, u.ID)
	if err != nil {
		return nil, encryptionError(err)
	}
	if data == nil {
		return nil, status.Errorf(codes.NotFound, "encryption vault not configured")
	}
	return &apipb.EncryptionVault{Vault: data}, nil
}

// CreateEncryptionVault creates the caller's immutable vault identity once.
func (s *APIService) CreateEncryptionVault(ctx context.Context, r *apipb.CreateEncryptionVaultRequest) (*apipb.EncryptionVault, error) {
	u, err := s.fetchCurrentUser(ctx)
	if err != nil {
		return nil, err
	}
	if u == nil {
		return nil, status.Errorf(codes.Unauthenticated, "sign in required")
	}
	if err := s.Store.CreateEncryptionVault(ctx, u.ID, r.Vault); err != nil {
		return nil, encryptionError(err)
	}
	return &apipb.EncryptionVault{Vault: r.Vault}, nil
}

// UpdateEncryptionVault replaces the caller's passphrase wrapper using CAS.
func (s *APIService) UpdateEncryptionVault(ctx context.Context, r *apipb.UpdateEncryptionVaultRequest) (*apipb.EncryptionVault, error) {
	u, err := s.fetchCurrentUser(ctx)
	if err != nil {
		return nil, err
	}
	if u == nil {
		return nil, status.Errorf(codes.Unauthenticated, "sign in required")
	}
	if err := s.Store.UpdateEncryptionVault(ctx, u.ID, r.Vault, r.ExpectedRevision); err != nil {
		return nil, encryptionError(err)
	}
	return &apipb.EncryptionVault{Vault: r.Vault}, nil
}

func (s *ConnectServiceHandler) GetEncryptionVault(ctx context.Context, r *connect.Request[apipb.GetEncryptionVaultRequest]) (*connect.Response[apipb.EncryptionVault], error) {
	resp, err := s.APIService.GetEncryptionVault(ctx, r.Msg)
	if err != nil {
		return nil, convertGRPCError(err)
	}
	return connect.NewResponse(resp), nil
}

func (s *ConnectServiceHandler) CreateEncryptionVault(ctx context.Context, r *connect.Request[apipb.CreateEncryptionVaultRequest]) (*connect.Response[apipb.EncryptionVault], error) {
	resp, err := s.APIService.CreateEncryptionVault(ctx, r.Msg)
	if err != nil {
		return nil, convertGRPCError(err)
	}
	return connect.NewResponse(resp), nil
}

func (s *ConnectServiceHandler) UpdateEncryptionVault(ctx context.Context, r *connect.Request[apipb.UpdateEncryptionVaultRequest]) (*connect.Response[apipb.EncryptionVault], error) {
	resp, err := s.APIService.UpdateEncryptionVault(ctx, r.Msg)
	if err != nil {
		return nil, convertGRPCError(err)
	}
	return connect.NewResponse(resp), nil
}
