package store

import (
	"context"
	"database/sql"
	"encoding/base64"
	"strings"

	"github.com/pkg/errors"
)

// MaxEncryptionPasskeys bounds wrapped passkey registrations per account.
const MaxEncryptionPasskeys = 10

// PasskeyRecord stores a PRF-derived wrapper, never a plaintext key or PRF output.
type PasskeyRecord struct {
	Version      int        `json:"version"`
	ID           string     `json:"id"`
	VaultID      string     `json:"vaultId"`
	CredentialID string     `json:"credentialId"`
	RPID         string     `json:"rpId"`
	Salt         string     `json:"salt"`
	Key          Ciphertext `json:"key"`
}

// ParsePasskeyRecord validates the exact bounded version-1 protocol.
func ParsePasskeyRecord(data []byte) (*PasskeyRecord, error) {
	var p PasskeyRecord
	if err := decodeRecord(data, &p, 4096); err != nil {
		return nil, err
	}
	credential, err := base64.RawURLEncoding.Strict().DecodeString(p.CredentialID)
	if p.Version != 1 || !validID(p.ID) || !validID(p.VaultID) || err != nil || len(credential) < 1 || len(credential) > 1024 || base64.RawURLEncoding.EncodeToString(credential) != p.CredentialID || !validRPID(p.RPID) || !validBase64(p.Salt, 32, 32) || !validBase64(p.Key.Nonce, 12, 12) || !validBase64(p.Key.Ciphertext, 48, 48) {
		return nil, ErrEncryptionPolicy
	}
	return &p, nil
}

// validRPID validates the lowercase hostname stored with a passkey wrapper.
func validRPID(s string) bool {
	if len(s) == 0 || len(s) > 253 {
		return false
	}
	for label := range strings.SplitSeq(s, ".") {
		if len(label) == 0 || len(label) > 63 || label[0] == '-' || label[len(label)-1] == '-' {
			return false
		}
		for _, c := range label {
			if !(c >= 'a' && c <= 'z' || c >= '0' && c <= '9' || c == '-') {
				return false
			}
		}
	}
	return true
}

// ListEncryptionPasskeys reads only the specified owner's separate wrappers.
func (s *Store) ListEncryptionPasskeys(ctx context.Context, userID int32) ([][]byte, error) {
	rows, err := s.driver.GetDB().QueryContext(ctx, s.encryptionQuery("SELECT record FROM encryption_passkey WHERE user_id = ? ORDER BY id"), userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	records := make([][]byte, 0)
	for rows.Next() {
		var data []byte
		if err := rows.Scan(&data); err != nil {
			return nil, err
		}
		records = append(records, data)
	}
	return records, rows.Err()
}

// CreateEncryptionPasskey serializes enrollment with account deletion and other enrollments.
func (s *Store) CreateEncryptionPasskey(ctx context.Context, userID int32, data []byte) error {
	p, err := ParsePasskeyRecord(data)
	if err != nil {
		return err
	}
	tx, err := s.driver.GetDB().BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback() }()
	userTable := `"user"`
	if s.profile.Driver == "mysql" {
		userTable = "`user`"
	}
	// A write obtains SQLite's writer lock before any read; row locking serializes
	// MySQL/PostgreSQL enrollments even when the registration set is empty.
	if _, err = tx.ExecContext(ctx, s.encryptionQuery("UPDATE "+userTable+" SET id = id WHERE id = ?"), userID); err != nil {
		return err
	}
	var liveID int32
	if err = tx.QueryRowContext(ctx, s.encryptionQuery("SELECT id FROM "+userTable+" WHERE id = ? AND row_status = 'NORMAL'"), userID).Scan(&liveID); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return ErrEncryptionPolicy
		}
		return err
	}
	var vaultID string
	if err = tx.QueryRowContext(ctx, s.encryptionQuery("SELECT vault_id FROM encryption_vault WHERE user_id = ?"), userID).Scan(&vaultID); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return ErrEncryptionPolicy
		}
		return err
	}
	if vaultID != p.VaultID {
		return ErrEncryptionPolicy
	}
	var count int
	if err = tx.QueryRowContext(ctx, s.encryptionQuery("SELECT COUNT(*) FROM encryption_passkey WHERE user_id = ?"), userID).Scan(&count); err != nil {
		return err
	}
	if count >= MaxEncryptionPasskeys {
		return ErrEncryptionConflict
	}
	var duplicate int
	if err = tx.QueryRowContext(ctx, s.encryptionQuery("SELECT COUNT(*) FROM encryption_passkey WHERE user_id = ? AND (id = ? OR credential_id = ?)"), userID, p.ID, p.CredentialID).Scan(&duplicate); err != nil {
		return err
	}
	if duplicate != 0 {
		return ErrEncryptionConflict
	}
	if _, err = tx.ExecContext(ctx, s.encryptionQuery("INSERT INTO encryption_passkey (user_id,id,credential_id,record) VALUES (?,?,?,?)"), userID, p.ID, p.CredentialID, string(data)); err != nil {
		return err
	}
	return tx.Commit()
}

// DeleteEncryptionPasskey idempotently removes only an owner-scoped wrapper.
func (s *Store) DeleteEncryptionPasskey(ctx context.Context, userID int32, id string) error {
	if !validID(id) {
		return ErrEncryptionPolicy
	}
	_, err := s.driver.GetDB().ExecContext(ctx, s.encryptionQuery("DELETE FROM encryption_passkey WHERE user_id = ? AND id = ?"), userID, id)
	return err
}
