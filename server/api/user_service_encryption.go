package api

import (
	"context"
	"errors"

	"connectrpc.com/connect"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/emptypb"

	apipb "github.com/usememos/memos/proto/gen/api"
	"github.com/usememos/memos/store"
)

// encryptionError maps vault policy and revision errors to public RPC statuses.
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

// GetEncryptionVault adapts the authenticated encryption service result to Connect.
func (s *ConnectServiceHandler) GetEncryptionVault(ctx context.Context, r *connect.Request[apipb.GetEncryptionVaultRequest]) (*connect.Response[apipb.EncryptionVault], error) {
	resp, err := s.APIService.GetEncryptionVault(ctx, r.Msg)
	if err != nil {
		return nil, convertGRPCError(err)
	}
	return connect.NewResponse(resp), nil
}

// CreateEncryptionVault adapts the authenticated encryption service result to Connect.
func (s *ConnectServiceHandler) CreateEncryptionVault(ctx context.Context, r *connect.Request[apipb.CreateEncryptionVaultRequest]) (*connect.Response[apipb.EncryptionVault], error) {
	resp, err := s.APIService.CreateEncryptionVault(ctx, r.Msg)
	if err != nil {
		return nil, convertGRPCError(err)
	}
	return connect.NewResponse(resp), nil
}

// UpdateEncryptionVault adapts the authenticated encryption service result to Connect.
func (s *ConnectServiceHandler) UpdateEncryptionVault(ctx context.Context, r *connect.Request[apipb.UpdateEncryptionVaultRequest]) (*connect.Response[apipb.EncryptionVault], error) {
	resp, err := s.APIService.UpdateEncryptionVault(ctx, r.Msg)
	if err != nil {
		return nil, convertGRPCError(err)
	}
	return connect.NewResponse(resp), nil
}

// ListEncryptionPasskeys operates only on the authenticated caller's passkey wrappers.
func (s *APIService) ListEncryptionPasskeys(ctx context.Context, r *apipb.ListEncryptionPasskeysRequest) (*apipb.ListEncryptionPasskeysResponse, error) {
	u, err := s.fetchCurrentUser(ctx)
	if err != nil {
		return nil, err
	}
	if u == nil {
		return nil, status.Errorf(codes.Unauthenticated, "sign in required")
	}
	data, err := s.Store.ListEncryptionPasskeys(ctx, u.ID)
	if err != nil {
		return nil, encryptionError(err)
	}
	return &apipb.ListEncryptionPasskeysResponse{Passkeys: data}, nil
}

// ListEncryptionPasskeys adapts the authenticated encryption service result to Connect.
func (s *ConnectServiceHandler) ListEncryptionPasskeys(ctx context.Context, r *connect.Request[apipb.ListEncryptionPasskeysRequest]) (*connect.Response[apipb.ListEncryptionPasskeysResponse], error) {
	resp, err := s.APIService.ListEncryptionPasskeys(ctx, r.Msg)
	if err != nil {
		return nil, convertGRPCError(err)
	}
	return connect.NewResponse(resp), nil
}

// CreateEncryptionPasskey operates only on the authenticated caller's passkey wrappers.
func (s *APIService) CreateEncryptionPasskey(ctx context.Context, r *apipb.CreateEncryptionPasskeyRequest) (*apipb.EncryptionPasskey, error) {
	u, err := s.fetchCurrentUser(ctx)
	if err != nil {
		return nil, err
	}
	if u == nil {
		return nil, status.Errorf(codes.Unauthenticated, "sign in required")
	}
	if err := s.Store.CreateEncryptionPasskey(ctx, u.ID, r.Passkey); err != nil {
		return nil, encryptionError(err)
	}
	return &apipb.EncryptionPasskey{Passkey: r.Passkey}, nil
}

// CreateEncryptionPasskey adapts the authenticated encryption service result to Connect.
func (s *ConnectServiceHandler) CreateEncryptionPasskey(ctx context.Context, r *connect.Request[apipb.CreateEncryptionPasskeyRequest]) (*connect.Response[apipb.EncryptionPasskey], error) {
	resp, err := s.APIService.CreateEncryptionPasskey(ctx, r.Msg)
	if err != nil {
		return nil, convertGRPCError(err)
	}
	return connect.NewResponse(resp), nil
}

// DeleteEncryptionPasskey operates only on the authenticated caller's passkey wrappers.
func (s *APIService) DeleteEncryptionPasskey(ctx context.Context, r *apipb.DeleteEncryptionPasskeyRequest) (*emptypb.Empty, error) {
	u, err := s.fetchCurrentUser(ctx)
	if err != nil {
		return nil, err
	}
	if u == nil {
		return nil, status.Errorf(codes.Unauthenticated, "sign in required")
	}
	if err := s.Store.DeleteEncryptionPasskey(ctx, u.ID, r.Id); err != nil {
		return nil, encryptionError(err)
	}
	return &emptypb.Empty{}, nil
}

// DeleteEncryptionPasskey adapts the authenticated encryption service result to Connect.
func (s *ConnectServiceHandler) DeleteEncryptionPasskey(ctx context.Context, r *connect.Request[apipb.DeleteEncryptionPasskeyRequest]) (*connect.Response[emptypb.Empty], error) {
	resp, err := s.APIService.DeleteEncryptionPasskey(ctx, r.Msg)
	if err != nil {
		return nil, convertGRPCError(err)
	}
	return connect.NewResponse(resp), nil
}
