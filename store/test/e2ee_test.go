package test

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/require"
	"google.golang.org/protobuf/encoding/protojson"

	storepb "github.com/usememos/memos/proto/gen/store"
	"github.com/usememos/memos/store"
)

func encryptedTestJSON(t *testing.T, v any) []byte {
	t.Helper()
	b, e := json.Marshal(v)
	require.NoError(t, e)
	return b
}
func encryptedTestCipher() store.Ciphertext {
	return store.Ciphertext{Nonce: base64.StdEncoding.EncodeToString(make([]byte, 12)), Ciphertext: base64.StdEncoding.EncodeToString(make([]byte, 48))}
}
func TestEncryptionPersistence(t *testing.T) {
	ctx := context.Background()
	s := NewTestingStore(ctx, t)
	defer s.Close()
	owner, err := s.CreateUser(ctx, &store.User{Username: "encrypted-owner", Role: store.RoleUser})
	require.NoError(t, err)
	peer, err := s.CreateUser(ctx, &store.User{Username: "encrypted-peer", Role: store.RoleUser})
	require.NoError(t, err)
	v := store.VaultRecord{Version: 1, ID: uuid.NewString(), Revision: uuid.NewString(), Salt: base64.StdEncoding.EncodeToString(make([]byte, 16)), PassphraseKey: encryptedTestCipher(), RecoveryKey: encryptedTestCipher()}
	vault := encryptedTestJSON(t, v)
	require.NoError(t, s.CreateEncryptionVault(ctx, owner.ID, vault))
	require.ErrorIs(t, s.CreateEncryptionVault(ctx, owner.ID, vault), store.ErrEncryptionConflict)
	got, err := s.GetEncryptionVault(ctx, peer.ID)
	require.NoError(t, err)
	require.Empty(t, got)
	original := v.Revision
	v.Revision = uuid.NewString()
	require.NoError(t, s.UpdateEncryptionVault(ctx, owner.ID, encryptedTestJSON(t, v), original))
	require.ErrorIs(t, s.UpdateEncryptionVault(ctx, owner.ID, encryptedTestJSON(t, v), original), store.ErrEncryptionConflict)
	envelope := store.EncryptedEnvelope{Version: 1, VaultID: v.ID, ObjectID: uuid.NewString(), RevisionID: uuid.NewString(), Body: encryptedTestCipher(), DataKey: encryptedTestCipher()}
	payload := func() *storepb.MemoPayload {
		return &storepb.MemoPayload{EncryptedContent: encryptedTestJSON(t, envelope)}
	}
	m, err := s.CreateMemo(ctx, &store.Memo{UID: "encrypted-memo", CreatorID: owner.ID, Visibility: store.Private, Payload: payload()})
	require.NoError(t, err)
	_, err = s.CreateMemo(ctx, &store.Memo{UID: "duplicate-object", CreatorID: owner.ID, Visibility: store.Private, Payload: payload()})
	require.Error(t, err)
	_, err = s.CreateMemo(ctx, &store.Memo{UID: "foreign-vault", CreatorID: peer.ID, Visibility: store.Private, Payload: payload()})
	require.ErrorIs(t, err, store.ErrEncryptionPolicy)
	require.ErrorIs(t, s.UpdateMemo(ctx, &store.UpdateMemo{ID: m.ID, Content: new("canary plaintext")}), store.ErrEncryptionPolicy)
	require.ErrorIs(t, s.UpdateMemo(ctx, &store.UpdateMemo{ID: m.ID, Visibility: new(store.Public)}), store.ErrEncryptionPolicy)
	original = envelope.RevisionID
	envelope.RevisionID = uuid.NewString()
	require.NoError(t, s.UpdateMemo(ctx, &store.UpdateMemo{ID: m.ID, Payload: payload(), ExpectedEncryptionRevision: original}))
	require.ErrorIs(t, s.UpdateMemo(ctx, &store.UpdateMemo{ID: m.ID, Payload: payload(), ExpectedEncryptionRevision: original}), store.ErrEncryptionConflict)
	original = envelope.RevisionID
	envelope.ObjectID = uuid.NewString()
	envelope.RevisionID = uuid.NewString()
	require.ErrorIs(t, s.UpdateMemo(ctx, &store.UpdateMemo{ID: m.ID, Payload: payload(), ExpectedEncryptionRevision: original}), store.ErrEncryptionPolicy)
	stored, err := s.GetMemo(ctx, &store.FindMemo{ID: &m.ID})
	require.NoError(t, err)
	require.Empty(t, stored.Content)
	require.Empty(t, stored.Payload.Tags)
	require.Nil(t, stored.Payload.Property)
	for _, expression := range []string{`!content.contains("absent")`, `size(tags) == 0`, `!has_link`} {
		matches, err := s.ListMemos(ctx, &store.FindMemo{ID: &m.ID, Filters: []string{expression}})
		require.NoError(t, err)
		require.Empty(t, matches, "content filters must exclude ciphertext")
	}

	current, err := store.ParseEncryptedEnvelope(stored.Payload.EncryptedContent)
	require.NoError(t, err)
	results := make(chan error, 2)
	start := make(chan struct{})
	for range 2 {
		next := *current
		next.RevisionID = uuid.NewString()
		data := encryptedTestJSON(t, next)
		go func() {
			<-start
			results <- s.ApplyMemoMutation(ctx, &store.MemoMutation{MemoID: m.ID, MemoCreatorID: owner.ID, ExpectedMemoContent: "", MemoUpdate: &store.UpdateMemo{ID: m.ID, ExpectedEncryptionRevision: current.RevisionID, Payload: &storepb.MemoPayload{EncryptedContent: data}, Policy: &store.MemoWritePolicy{ActorUserID: owner.ID}}})
		}()
	}
	close(start)
	success, conflict := 0, 0
	for range 2 {
		err := <-results
		if err == nil {
			success++
		} else if err == store.ErrEncryptionConflict {
			conflict++
		} else {
			require.NoError(t, err)
		}
	}
	require.Equal(t, 1, success)
	require.Equal(t, 1, conflict)
	stored, err = s.GetMemo(ctx, &store.FindMemo{ID: &m.ID})
	require.NoError(t, err)
	if os.Getenv("DRIVER") == "sqlite" {
		backup := filepath.Join(t.TempDir(), "backup.db")
		_, err = s.GetDriver().GetDB().ExecContext(ctx, "VACUUM INTO ?", backup)
		require.NoError(t, err)
		restored := NewTestingStoreWithDSN(ctx, t, "sqlite", backup)
		defer restored.Close()
		restoredVault, err := restored.GetEncryptionVault(ctx, owner.ID)
		require.NoError(t, err)
		require.Equal(t, encryptedTestJSON(t, v), restoredVault)
		restoredMemo, err := restored.GetMemo(ctx, &store.FindMemo{ID: &m.ID})
		require.NoError(t, err)
		require.Equal(t, stored.Payload.EncryptedContent, restoredMemo.Payload.EncryptedContent)
		restoredEnvelope, err := store.ParseEncryptedEnvelope(restoredMemo.Payload.EncryptedContent)
		require.NoError(t, err)
		before := restoredEnvelope.RevisionID
		restoredEnvelope.RevisionID = uuid.NewString()
		require.NoError(t, restored.UpdateMemo(ctx, &store.UpdateMemo{ID: m.ID, ExpectedEncryptionRevision: before, Payload: &storepb.MemoPayload{EncryptedContent: encryptedTestJSON(t, restoredEnvelope)}}))
	}

	_, err = s.CreateAttachment(ctx, &store.Attachment{UID: "forbidden-file", CreatorID: owner.ID, Filename: "test.txt", MemoID: &m.ID})
	require.ErrorIs(t, err, store.ErrEncryptionPolicy)
	_, err = s.UpsertReaction(ctx, &store.Reaction{MemoID: m.ID, CreatorID: owner.ID, ReactionType: "x"})
	require.ErrorIs(t, err, store.ErrEncryptionPolicy)
	_, err = s.CreateMemoShare(ctx, &store.MemoShare{MemoID: m.ID, CreatorID: owner.ID})
	require.ErrorIs(t, err, store.ErrEncryptionPolicy)
	plain, err := s.CreateMemo(ctx, &store.Memo{UID: "plain-memo", CreatorID: owner.ID, Content: "plain", Visibility: store.Private})
	require.NoError(t, err)
	require.ErrorIs(t, s.UpdateMemo(ctx, &store.UpdateMemo{ID: plain.ID, Payload: payload()}), store.ErrEncryptionPolicy)
	_, err = s.UpsertMemoRelation(ctx, &store.MemoRelation{MemoID: plain.ID, RelatedMemoID: m.ID, Type: store.MemoRelationReference})
	require.ErrorIs(t, err, store.ErrEncryptionPolicy)
	_, err = s.CreateMemoComment(ctx, &store.Memo{UID: "forbidden-comment", CreatorID: owner.ID, Content: "comment", Visibility: store.Private}, m.ID, owner.ID)
	require.ErrorIs(t, err, store.ErrEncryptionPolicy)
	require.NoError(t, s.DeleteMemo(ctx, &store.DeleteMemo{ID: m.ID}))
	var remaining int
	require.NoError(t, s.GetDriver().GetDB().QueryRowContext(ctx, "SELECT COUNT(*) FROM memo_encryption").Scan(&remaining))
	require.Zero(t, remaining)
	_, err = s.DeleteUser(ctx, &store.DeleteUser{ID: owner.ID})
	require.NoError(t, err)
	got, err = s.GetEncryptionVault(ctx, owner.ID)
	require.NoError(t, err)

	require.Empty(t, got)
	require.Error(t, s.CreateEncryptionVault(ctx, owner.ID, encryptedTestJSON(t, v)))
	replacement, err := s.CreateUser(ctx, &store.User{Username: "encrypted-owner", Role: store.RoleUser})
	require.NoError(t, err)
	got, err = s.GetEncryptionVault(ctx, replacement.ID)
	require.NoError(t, err)
	require.Empty(t, got)
}

// The deletion transaction starts its repeatable-read snapshot while the creator
// holds the owner lock. After that creator commits, deletion must collect the
// newly committed memo with a current read, not the older snapshot.
func TestEncryptionMySQLDeleteSeesConcurrentCreate(t *testing.T) {
	if os.Getenv("DRIVER") != "mysql" {
		t.Skip("MySQL snapshot regression")
	}
	ctx := context.Background()
	s := NewTestingStore(ctx, t)
	defer s.Close()
	owner, err := s.CreateUser(ctx, &store.User{Username: "concurrent-owner", Role: store.RoleUser})
	require.NoError(t, err)
	vault := store.VaultRecord{Version: 1, ID: uuid.NewString(), Revision: uuid.NewString(), Salt: base64.StdEncoding.EncodeToString(make([]byte, 16)), PassphraseKey: encryptedTestCipher(), RecoveryKey: encryptedTestCipher()}
	require.NoError(t, s.CreateEncryptionVault(ctx, owner.ID, encryptedTestJSON(t, vault)))
	envelope := store.EncryptedEnvelope{Version: 1, VaultID: vault.ID, ObjectID: uuid.NewString(), RevisionID: uuid.NewString(), Body: encryptedTestCipher(), DataKey: encryptedTestCipher()}
	payload := &storepb.MemoPayload{EncryptedContent: encryptedTestJSON(t, envelope)}
	tx, err := s.GetDriver().GetDB().BeginTx(ctx, nil)
	require.NoError(t, err)
	defer tx.Rollback()
	var id int32
	require.NoError(t, tx.QueryRowContext(ctx, "SELECT id FROM user WHERE id = ? FOR UPDATE", owner.ID).Scan(&id))
	deleted := make(chan error, 1)
	go func() { _, err := s.DeleteUser(ctx, &store.DeleteUser{ID: owner.ID}); deleted <- err }()
	require.Eventually(t, func() bool {
		var waiting int
		err := s.GetDriver().GetDB().QueryRowContext(ctx, "SELECT COUNT(*) FROM performance_schema.data_lock_waits").Scan(&waiting)
		return err == nil && waiting > 0
	}, 5*time.Second, 10*time.Millisecond)
	raw, err := protojson.Marshal(payload)
	require.NoError(t, err)
	result, err := tx.ExecContext(ctx, "INSERT INTO memo (uid,creator_id,content,visibility,payload) VALUES (?,?,?, ?,?)", "concurrent-encrypted", owner.ID, "", store.Private, string(raw))
	require.NoError(t, err)
	memoID, err := result.LastInsertId()
	require.NoError(t, err)
	require.NoError(t, store.InsertMemoEncryption(ctx, tx, &store.Memo{ID: int32(memoID), CreatorID: owner.ID, Visibility: store.Private, Payload: payload}, false))
	require.NoError(t, tx.Commit())
	require.NoError(t, <-deleted)
	for _, table := range []string{"memo", "memo_encryption", "encryption_vault"} {
		var remaining int
		require.NoError(t, s.GetDriver().GetDB().QueryRowContext(ctx, "SELECT COUNT(*) FROM "+table).Scan(&remaining))
		require.Zero(t, remaining, table)
	}
}
