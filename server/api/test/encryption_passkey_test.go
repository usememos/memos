package test

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	apipb "github.com/usememos/memos/proto/gen/api"
	"github.com/usememos/memos/store"
)

func TestEncryptionPasskeyAPI(t *testing.T) {
	ctx := context.Background()
	ts := NewTestService(t)
	defer ts.Cleanup()
	owner, err := ts.CreateRegularUser(ctx, "passkey-owner")
	require.NoError(t, err)
	ownerCtx := ts.CreateUserContext(ctx, owner.ID)
	peer, err := ts.CreateRegularUser(ctx, "passkey-peer")
	require.NoError(t, err)
	admin, err := ts.CreateHostUser(ctx, "passkey-admin")
	require.NoError(t, err)
	encode := func(v any) []byte { b, err := json.Marshal(v); require.NoError(t, err); return b }
	cipher := store.Ciphertext{Nonce: base64.StdEncoding.EncodeToString(make([]byte, 12)), Ciphertext: base64.StdEncoding.EncodeToString(make([]byte, 48))}
	vault := store.VaultRecord{Version: 1, ID: uuid.NewString(), Revision: uuid.NewString(), Salt: base64.StdEncoding.EncodeToString(make([]byte, 16)), PassphraseKey: cipher, RecoveryKey: cipher}
	_, err = ts.Service.CreateEncryptionVault(ownerCtx, &apipb.CreateEncryptionVaultRequest{Vault: encode(vault)})
	require.NoError(t, err)
	p := store.PasskeyRecord{Version: 1, ID: uuid.NewString(), VaultID: vault.ID, CredentialID: "AA", RPID: "localhost", Salt: base64.StdEncoding.EncodeToString(make([]byte, 32)), Key: cipher}
	_, err = ts.Service.ListEncryptionPasskeys(ctx, &apipb.ListEncryptionPasskeysRequest{})
	require.Equal(t, codes.Unauthenticated, status.Code(err))
	_, err = ts.Service.CreateEncryptionPasskey(ctx, &apipb.CreateEncryptionPasskeyRequest{Passkey: encode(p)})
	require.Equal(t, codes.Unauthenticated, status.Code(err))
	_, err = ts.Service.DeleteEncryptionPasskey(ctx, &apipb.DeleteEncryptionPasskeyRequest{Id: p.ID})
	require.Equal(t, codes.Unauthenticated, status.Code(err))
	created, err := ts.Service.CreateEncryptionPasskey(ownerCtx, &apipb.CreateEncryptionPasskeyRequest{Passkey: encode(p)})
	require.NoError(t, err)
	require.Equal(t, encode(p), created.Passkey)
	_, err = ts.Service.CreateEncryptionPasskey(ownerCtx, &apipb.CreateEncryptionPasskeyRequest{Passkey: encode(p)})
	require.Equal(t, codes.Aborted, status.Code(err))
	_, err = ts.Service.CreateEncryptionPasskey(ownerCtx, &apipb.CreateEncryptionPasskeyRequest{Passkey: []byte("{}")})
	require.Equal(t, codes.InvalidArgument, status.Code(err))
	for _, id := range []int32{peer.ID, admin.ID} {
		other := ts.CreateUserContext(ctx, id)
		list, err := ts.Service.ListEncryptionPasskeys(other, &apipb.ListEncryptionPasskeysRequest{})
		require.NoError(t, err)
		require.Empty(t, list.Passkeys)
		_, err = ts.Service.DeleteEncryptionPasskey(other, &apipb.DeleteEncryptionPasskeyRequest{Id: p.ID})
		require.NoError(t, err)
		_, err = ts.Service.CreateEncryptionPasskey(other, &apipb.CreateEncryptionPasskeyRequest{Passkey: encode(p)})
		require.Equal(t, codes.InvalidArgument, status.Code(err))
	}
	list, err := ts.Service.ListEncryptionPasskeys(ownerCtx, &apipb.ListEncryptionPasskeysRequest{})
	require.NoError(t, err)
	require.Equal(t, [][]byte{encode(p)}, list.Passkeys)
	for range 2 {
		_, err = ts.Service.DeleteEncryptionPasskey(ownerCtx, &apipb.DeleteEncryptionPasskeyRequest{Id: p.ID})
		require.NoError(t, err)
	}
	list, err = ts.Service.ListEncryptionPasskeys(ownerCtx, &apipb.ListEncryptionPasskeysRequest{})
	require.NoError(t, err)
	require.Empty(t, list.Passkeys)
}
