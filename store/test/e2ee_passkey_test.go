package test

import (
	"context"
	"encoding/base64"
	"os"
	"path/filepath"
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/require"

	"github.com/usememos/memos/store"
)

func TestEncryptionPasskeyPersistence(t *testing.T) {
	ctx := context.Background()
	s := NewTestingStore(ctx, t)
	defer s.Close()
	// Exercise the incremental migration from the existing vault schema too.
	_, err := s.GetDriver().GetDB().ExecContext(ctx, "DROP TABLE encryption_passkey")
	require.NoError(t, err)
	setSchemaVersion(ctx, t, s, "26.11.1")
	require.NoError(t, s.Migrate(ctx))
	owner, err := s.CreateUser(ctx, &store.User{Username: "passkey-owner", Role: store.RoleUser})
	require.NoError(t, err)
	peer, err := s.CreateUser(ctx, &store.User{Username: "passkey-peer", Role: store.RoleUser})
	require.NoError(t, err)
	v := store.VaultRecord{Version: 1, ID: uuid.NewString(), Revision: uuid.NewString(), Salt: base64.StdEncoding.EncodeToString(make([]byte, 16)), PassphraseKey: encryptedTestCipher(), RecoveryKey: encryptedTestCipher()}
	p := store.PasskeyRecord{Version: 1, ID: uuid.NewString(), VaultID: v.ID, CredentialID: "AA", RPID: "localhost", Salt: base64.StdEncoding.EncodeToString(make([]byte, 32)), Key: encryptedTestCipher()}
	require.ErrorIs(t, s.CreateEncryptionPasskey(ctx, owner.ID, encryptedTestJSON(t, p)), store.ErrEncryptionPolicy)
	require.NoError(t, s.CreateEncryptionVault(ctx, owner.ID, encryptedTestJSON(t, v)))
	require.ErrorIs(t, s.CreateEncryptionPasskey(ctx, peer.ID, encryptedTestJSON(t, p)), store.ErrEncryptionPolicy)
	foreign := p
	foreign.VaultID = uuid.NewString()
	require.ErrorIs(t, s.CreateEncryptionPasskey(ctx, owner.ID, encryptedTestJSON(t, foreign)), store.ErrEncryptionPolicy)
	require.NoError(t, s.CreateEncryptionPasskey(ctx, owner.ID, encryptedTestJSON(t, p)))
	duplicate := p
	duplicate.ID = uuid.NewString()
	require.ErrorIs(t, s.CreateEncryptionPasskey(ctx, owner.ID, encryptedTestJSON(t, duplicate)), store.ErrEncryptionConflict)
	duplicate = p
	duplicate.CredentialID = "AQ"
	require.ErrorIs(t, s.CreateEncryptionPasskey(ctx, owner.ID, encryptedTestJSON(t, duplicate)), store.ErrEncryptionConflict)
	got, err := s.ListEncryptionPasskeys(ctx, peer.ID)
	require.NoError(t, err)
	require.Empty(t, got)
	require.NoError(t, s.DeleteEncryptionPasskey(ctx, peer.ID, p.ID))
	old := v.Revision
	v.Revision = uuid.NewString()
	require.NoError(t, s.UpdateEncryptionVault(ctx, owner.ID, encryptedTestJSON(t, v), old))
	got, err = s.ListEncryptionPasskeys(ctx, owner.ID)
	require.NoError(t, err)
	require.Equal(t, [][]byte{encryptedTestJSON(t, p)}, got)
	if os.Getenv("DRIVER") == "sqlite" {
		backup := filepath.Join(t.TempDir(), "passkey-backup.db")
		_, err := s.GetDriver().GetDB().ExecContext(ctx, "VACUUM INTO ?", backup)
		require.NoError(t, err)
		restored := NewTestingStoreWithDSN(ctx, t, "sqlite", backup)
		defer restored.Close()
		records, err := restored.ListEncryptionPasskeys(ctx, owner.ID)
		require.NoError(t, err)
		require.Equal(t, got, records)
	}

	for i := 1; i < 9; i++ {
		next := p
		next.ID = uuid.NewString()
		next.CredentialID = base64.RawURLEncoding.EncodeToString([]byte{byte(i)})
		require.NoError(t, s.CreateEncryptionPasskey(ctx, owner.ID, encryptedTestJSON(t, next)))
	}
	start := make(chan struct{})
	results := make(chan error, 2)
	for i := 9; i < 11; i++ {
		next := p
		next.ID = uuid.NewString()
		next.CredentialID = base64.RawURLEncoding.EncodeToString([]byte{byte(i)})
		raw := encryptedTestJSON(t, next)
		go func() { <-start; results <- s.CreateEncryptionPasskey(ctx, owner.ID, raw) }()
	}
	close(start)
	successes := 0
	for range 2 {
		err := <-results
		if err == nil {
			successes++
		} else {
			require.ErrorIs(t, err, store.ErrEncryptionConflict)
		}
	}
	require.Equal(t, 1, successes)
	got, err = s.ListEncryptionPasskeys(ctx, owner.ID)
	require.NoError(t, err)
	require.Len(t, got, 10)
	require.ErrorIs(t, s.CreateEncryptionPasskey(ctx, owner.ID, encryptedTestJSON(t, duplicate)), store.ErrEncryptionConflict)
	require.NoError(t, s.DeleteEncryptionPasskey(ctx, owner.ID, p.ID))
	require.NoError(t, s.DeleteEncryptionPasskey(ctx, owner.ID, p.ID))
	_, err = s.DeleteUser(ctx, &store.DeleteUser{ID: owner.ID})
	require.NoError(t, err)
	got, err = s.ListEncryptionPasskeys(ctx, owner.ID)
	require.NoError(t, err)
	require.Empty(t, got)
	require.ErrorIs(t, s.CreateEncryptionPasskey(ctx, owner.ID, encryptedTestJSON(t, p)), store.ErrEncryptionPolicy)

	// Enrollment and deletion lock the same account; either ordering must leave no orphan.
	v.ID = uuid.NewString()
	p.VaultID = v.ID
	require.NoError(t, s.CreateEncryptionVault(ctx, peer.ID, encryptedTestJSON(t, v)))
	raw := encryptedTestJSON(t, p)
	gate := make(chan struct{})
	enrollment := make(chan error, 1)
	deletion := make(chan error, 1)
	go func() { <-gate; enrollment <- s.CreateEncryptionPasskey(ctx, peer.ID, raw) }()
	go func() { <-gate; _, err := s.DeleteUser(ctx, &store.DeleteUser{ID: peer.ID}); deletion <- err }()
	close(gate)
	require.NoError(t, <-deletion)
	if err := <-enrollment; err != nil {
		require.ErrorIs(t, err, store.ErrEncryptionPolicy)
	}
	got, err = s.ListEncryptionPasskeys(ctx, peer.ID)
	require.NoError(t, err)
	require.Empty(t, got)
}
