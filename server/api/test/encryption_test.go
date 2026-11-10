package test

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/fieldmaskpb"

	apipb "github.com/usememos/memos/proto/gen/api"
	"github.com/usememos/memos/store"
)

func TestEncryptionAPI(t *testing.T) {
	ctx := context.Background()
	ts := NewTestService(t)
	defer ts.Cleanup()
	user, err := ts.CreateRegularUser(ctx, "encryption-owner")
	require.NoError(t, err)
	ownerCtx := ts.CreateUserContext(ctx, user.ID)
	peer, err := ts.CreateRegularUser(ctx, "encryption-peer")
	require.NoError(t, err)
	peerCtx := ts.CreateUserContext(ctx, peer.ID)
	admin, err := ts.CreateHostUser(ctx, "encryption-admin")
	require.NoError(t, err)
	adminCtx := ts.CreateUserContext(ctx, admin.ID)
	encode := func(v any) []byte { b, e := json.Marshal(v); require.NoError(t, e); return b }
	cipher := store.Ciphertext{Nonce: base64.StdEncoding.EncodeToString(make([]byte, 12)), Ciphertext: base64.StdEncoding.EncodeToString(make([]byte, 48))}
	vault := store.VaultRecord{Version: 1, ID: uuid.NewString(), Revision: uuid.NewString(), Salt: base64.StdEncoding.EncodeToString(make([]byte, 16)), PassphraseKey: cipher, RecoveryKey: cipher}
	_, err = ts.Service.GetEncryptionVault(ctx, &apipb.GetEncryptionVaultRequest{})
	require.Equal(t, codes.Unauthenticated, status.Code(err))
	_, err = ts.Service.CreateEncryptionVault(ownerCtx, &apipb.CreateEncryptionVaultRequest{Vault: encode(vault)})
	require.NoError(t, err)
	_, err = ts.Service.CreateEncryptionVault(ownerCtx, &apipb.CreateEncryptionVaultRequest{Vault: encode(vault)})
	require.Equal(t, codes.Aborted, status.Code(err))
	for _, other := range []context.Context{peerCtx, adminCtx} {
		_, err = ts.Service.GetEncryptionVault(other, &apipb.GetEncryptionVaultRequest{})
		require.Equal(t, codes.NotFound, status.Code(err))
	}
	envelope := store.EncryptedEnvelope{Version: 1, VaultID: vault.ID, ObjectID: uuid.NewString(), RevisionID: uuid.NewString(), Body: cipher, DataKey: cipher}
	memo, err := ts.Service.CreateMemo(ownerCtx, &apipb.CreateMemoRequest{Memo: &apipb.Memo{Visibility: apipb.Visibility_PRIVATE, EncryptedContent: encode(envelope)}})
	require.NoError(t, err)
	require.Empty(t, memo.Content)
	require.Empty(t, memo.Snippet)
	require.Empty(t, memo.Tags)
	require.Equal(t, encode(envelope), memo.EncryptedContent)
	for _, other := range []context.Context{peerCtx, adminCtx} {
		_, err = ts.Service.GetMemo(other, &apipb.GetMemoRequest{Name: memo.Name})
		require.Equal(t, codes.PermissionDenied, status.Code(err))
	}
	_, err = ts.Service.UpdateMemo(ownerCtx, &apipb.UpdateMemoRequest{Memo: &apipb.Memo{Name: memo.Name, Content: "canary plaintext"}, UpdateMask: &fieldmaskpb.FieldMask{Paths: []string{"content"}}})
	require.Equal(t, codes.InvalidArgument, status.Code(err))
	old := envelope.RevisionID
	envelope.RevisionID = uuid.NewString()
	req := &apipb.UpdateMemoRequest{Memo: &apipb.Memo{Name: memo.Name, EncryptedContent: encode(envelope)}, UpdateMask: &fieldmaskpb.FieldMask{Paths: []string{"encrypted_content"}}, ExpectedEncryptionRevision: old}
	_, err = ts.Service.UpdateMemo(ownerCtx, req)
	require.NoError(t, err)
	_, err = ts.Service.UpdateMemo(ownerCtx, req)
	require.Equal(t, codes.Aborted, status.Code(err))

	// Competing encrypted saves share a revision; exactly one commits and the
	// loser receives an actionable conflict, never a silent overwrite.
	expected := envelope.RevisionID
	results := make(chan error, 2)
	start := make(chan struct{})
	for range 2 {
		next := envelope
		next.RevisionID = uuid.NewString()
		data := encode(next)
		go func() {
			<-start
			_, err := ts.Service.UpdateMemo(ownerCtx, &apipb.UpdateMemoRequest{Memo: &apipb.Memo{Name: memo.Name, EncryptedContent: data}, UpdateMask: &fieldmaskpb.FieldMask{Paths: []string{"encrypted_content"}}, ExpectedEncryptionRevision: expected})
			results <- err
		}()
	}
	close(start)
	success, conflict := 0, 0
	for range 2 {
		err := <-results
		if err == nil {
			success++
		} else if status.Code(err) == codes.Aborted {
			conflict++
		} else {
			require.NoError(t, err)
		}
	}
	require.Equal(t, 1, success)
	require.Equal(t, 1, conflict)
	_, err = ts.Service.CreateMemoComment(ownerCtx, &apipb.CreateMemoCommentRequest{Parent: memo.Name, Comment: &apipb.Memo{Content: "comment", Visibility: apipb.Visibility_PRIVATE}})
	require.Error(t, err)
	var archive bytes.Buffer
	err = ts.Service.WriteMemoExport(ownerCtx, user, &archive, time.Now())
	require.ErrorContains(t, err, "encrypted memos cannot be exported")
	require.Zero(t, archive.Len())
}
