package store

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/base64"
	"encoding/json"
	"io"
	"strconv"
	"strings"
	"unicode"
	"unicode/utf8"

	"github.com/google/uuid"
	"github.com/pkg/errors"
	"google.golang.org/protobuf/encoding/protojson"

	"github.com/usememos/memos/filter"
	storepb "github.com/usememos/memos/proto/gen/store"
)

// ErrEncryptionPolicy rejects an operation unsupported by private text encryption.
var ErrEncryptionPolicy = errors.New("encrypted memos support only private, unassigned text; this operation is unavailable")

// ErrEncryptionConflict indicates a stale encrypted revision or existing vault.
var ErrEncryptionConflict = errors.New("encryption revision conflict; reload before retrying")

// MaxEncryptedBody permits 1 MiB of plaintext plus the authentication tag.
const MaxEncryptedBody = 1024*1024 + 16

// Ciphertext is an AES-GCM operation with its nonce and appended tag.
type Ciphertext struct {
	Nonce      string `json:"nonce"`
	Ciphertext string `json:"ciphertext"`
}

// EncryptedEnvelope describes the immutable object identity and one content revision.
type EncryptedEnvelope struct {
	Version    int        `json:"version"`
	VaultID    string     `json:"vaultId"`
	ObjectID   string     `json:"objectId"`
	RevisionID string     `json:"revisionId"`
	Body       Ciphertext `json:"body"`
	DataKey    Ciphertext `json:"dataKey"`
}

// VaultRecord contains wrapped keys only; version 1 fixes the Argon2id profile.
type VaultRecord struct {
	Version       int        `json:"version"`
	ID            string     `json:"id"`
	Revision      string     `json:"revision"`
	Salt          string     `json:"salt"`
	PassphraseKey Ciphertext `json:"passphraseKey"`
	RecoveryKey   Ciphertext `json:"recoveryKey"`
}

func decodeRecord(data []byte, out any, limit int) error {
	if len(data) == 0 || len(data) > limit {
		return ErrEncryptionPolicy
	}
	if err := rejectDuplicateJSONFields(json.NewDecoder(bytes.NewReader(data))); err != nil {
		return ErrEncryptionPolicy
	}
	var fields map[string]json.RawMessage
	if err := json.Unmarshal(data, &fields); err != nil {
		return ErrEncryptionPolicy
	}
	var required, wrappers []string
	switch out.(type) {
	case *EncryptedEnvelope:
		required = []string{"version", "vaultId", "objectId", "revisionId", "body", "dataKey"}
		wrappers = []string{"body", "dataKey"}
	case *PasskeyRecord:
		required = []string{"version", "id", "vaultId", "credentialId", "rpId", "salt", "key"}
		wrappers = []string{"key"}
	case *VaultRecord:
		required = []string{"version", "id", "revision", "salt", "passphraseKey", "recoveryKey"}
		wrappers = []string{"passphraseKey", "recoveryKey"}
	default:
		return ErrEncryptionPolicy
	}
	if len(fields) != len(required) {
		return ErrEncryptionPolicy
	}
	for _, key := range required {
		if _, ok := fields[key]; !ok {
			return ErrEncryptionPolicy
		}
	}
	for _, key := range wrappers {
		var wrapper map[string]json.RawMessage
		if err := json.Unmarshal(fields[key], &wrapper); err != nil {
			return ErrEncryptionPolicy
		}
		if len(wrapper) != 2 || wrapper["nonce"] == nil || wrapper["ciphertext"] == nil {
			return ErrEncryptionPolicy
		}
	}
	decoder := json.NewDecoder(bytes.NewReader(data))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(out); err != nil {
		return ErrEncryptionPolicy
	}
	if err := decoder.Decode(new(any)); err != io.EOF {
		return ErrEncryptionPolicy
	}
	return nil
}
func validID(s string) bool {
	u, e := uuid.Parse(s)
	return e == nil && u.String() == s && u.Version() == 4 && u.Variant() == uuid.RFC4122
}
func validBase64(s string, minimum, maximum int) bool {
	b, e := base64.StdEncoding.Strict().DecodeString(s)
	return e == nil && len(b) >= minimum && len(b) <= maximum && base64.StdEncoding.EncodeToString(b) == s
}
func validCipher(c Ciphertext, maximum int) bool {
	return validBase64(c.Nonce, 12, 12) && validBase64(c.Ciphertext, 16, maximum)
}

// ParseEncryptedEnvelope validates bounded protocol v1 input without decrypting it.
func ParseEncryptedEnvelope(data []byte) (*EncryptedEnvelope, error) {
	var e EncryptedEnvelope
	if err := decodeRecord(data, &e, 1572864); err != nil {
		return nil, err
	}
	if e.Version != 1 || !validID(e.VaultID) || !validID(e.ObjectID) || !validID(e.RevisionID) || !validCipher(e.Body, MaxEncryptedBody) || !validCipher(e.DataKey, 48) || !validBase64(e.DataKey.Ciphertext, 48, 48) {
		return nil, ErrEncryptionPolicy
	}
	return &e, nil
}

// ParseVaultRecord validates the fixed-size wrapped vault keys.
func ParseVaultRecord(data []byte) (*VaultRecord, error) {
	var v VaultRecord
	if err := decodeRecord(data, &v, 4096); err != nil {
		return nil, err
	}
	if v.Version != 1 || !validID(v.ID) || !validID(v.Revision) || !validBase64(v.Salt, 16, 16) || !validCipher(v.PassphraseKey, 48) || !validCipher(v.RecoveryKey, 48) || !validBase64(v.PassphraseKey.Ciphertext, 48, 48) || !validBase64(v.RecoveryKey.Ciphertext, 48, 48) {
		return nil, ErrEncryptionPolicy
	}
	return &v, nil
}

// ValidateEncryptedTitle bounds the optional plaintext label; it is never parsed as Markdown.
func ValidateEncryptedTitle(title string) error {
	if !utf8.ValidString(title) || utf8.RuneCountInString(title) > 256 || strings.ContainsFunc(title, func(r rune) bool { return unicode.IsControl(r) || r == '\u2028' || r == '\u2029' }) {
		return ErrEncryptionPolicy
	}
	return nil
}

// IsEncryptedMemo reports the immutable encryption kind.
func IsEncryptedMemo(m *Memo) bool { return m != nil && len(m.Payload.GetEncryptedContent()) > 0 }

// EncryptionExecutor is the common transaction surface used by all SQL drivers.
type EncryptionExecutor interface {
	ExecContext(context.Context, string, ...any) (sql.Result, error)
	QueryRowContext(context.Context, string, ...any) *sql.Row
}

func encryptionSQL(query string, postgres bool) string {
	if !postgres {
		return query
	}
	i := 0
	for strings.Contains(query, "?") {
		i++
		query = strings.Replace(query, "?", "$"+strconv.Itoa(i), 1)
	}
	return query
}

// InsertMemoEncryption reserves an object identity in the memo creation transaction.
func InsertMemoEncryption(ctx context.Context, tx EncryptionExecutor, m *Memo, postgres bool) error {
	if !IsEncryptedMemo(m) {
		if m.Payload.GetEncryptedTitle() != "" {
			return ErrEncryptionPolicy
		}
		return nil
	}
	if err := ValidateEncryptedTitle(m.Payload.GetEncryptedTitle()); err != nil {
		return err
	}
	e, err := ParseEncryptedEnvelope(m.Payload.EncryptedContent)
	if err != nil {
		return err
	}
	if m.Content != "" || m.Visibility != Private || m.SpaceID != nil || m.ParentUID != nil || m.Payload.Location != nil || len(m.Payload.Tags) > 0 || m.Payload.Property != nil {
		return ErrEncryptionPolicy
	}
	var vaultID string
	if err := tx.QueryRowContext(ctx, encryptionSQL("SELECT vault_id FROM encryption_vault WHERE user_id = ?", postgres), m.CreatorID).Scan(&vaultID); err != nil {
		return ErrEncryptionPolicy
	}
	if vaultID != e.VaultID {
		return ErrEncryptionPolicy
	}
	_, err = tx.ExecContext(ctx, encryptionSQL("INSERT INTO memo_encryption (memo_id,vault_id,object_id,revision) VALUES (?,?,?,?)", postgres), m.ID, e.VaultID, e.ObjectID, e.RevisionID)
	return err
}

// ValidateEncryptedUpdate atomically checks encryption kind and advances the revision.
// It must run in the same transaction as the memo update.
func ValidateEncryptedUpdate(ctx context.Context, tx EncryptionExecutor, u *UpdateMemo, postgres bool) error {
	var raw []byte
	if err := tx.QueryRowContext(ctx, encryptionSQL("SELECT payload FROM memo WHERE id = ?", postgres), u.ID).Scan(&raw); err != nil {
		return err
	}
	p := &storepb.MemoPayload{}
	if err := protojson.Unmarshal(raw, p); err != nil {
		return err
	}
	if len(p.EncryptedContent) == 0 {
		if len(u.Payload.GetEncryptedContent()) > 0 || u.Payload.GetEncryptedTitle() != "" {
			return ErrEncryptionPolicy
		}
		return nil
	}
	if u.Content != nil || u.SpaceID != nil || (u.Visibility != nil && *u.Visibility != Private) {
		return ErrEncryptionPolicy
	}
	if u.Payload == nil {
		return nil
	}
	if ValidateEncryptedTitle(u.Payload.EncryptedTitle) != nil || u.Payload.Location != nil || u.Payload.Property != nil || len(u.Payload.Tags) > 0 {
		return ErrEncryptionPolicy
	}
	old, err := ParseEncryptedEnvelope(p.EncryptedContent)
	if err != nil {
		return err
	}
	next, err := ParseEncryptedEnvelope(u.Payload.EncryptedContent)
	if err != nil {
		return err
	}
	if old.VaultID != next.VaultID || old.ObjectID != next.ObjectID {
		return ErrEncryptionPolicy
	}
	if u.ExpectedEncryptionRevision != old.RevisionID || next.RevisionID == old.RevisionID {
		return ErrEncryptionConflict
	}
	result, err := tx.ExecContext(ctx, encryptionSQL("UPDATE memo_encryption SET revision = ? WHERE memo_id = ? AND revision = ?", postgres), next.RevisionID, u.ID, u.ExpectedEncryptionRevision)
	if err != nil {
		return err
	}
	n, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if n != 1 {
		return ErrEncryptionConflict
	}
	return nil
}

// GetEncryptionVault reads only the specified account's separate vault record.
func (s *Store) GetEncryptionVault(ctx context.Context, userID int32) ([]byte, error) {
	var data []byte
	err := s.driver.GetDB().QueryRowContext(ctx, s.encryptionQuery("SELECT record FROM encryption_vault WHERE user_id = ?"), userID).Scan(&data)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	return data, err
}
func (s *Store) encryptionQuery(q string) string {
	return encryptionSQL(q, s.profile.Driver == "postgres")
}

// CreateEncryptionVault never replaces an existing vault.
func (s *Store) CreateEncryptionVault(ctx context.Context, userID int32, data []byte) error {
	v, err := ParseVaultRecord(data)
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
	query := "SELECT id FROM " + userTable + " WHERE id = ? AND row_status = 'NORMAL'"
	if s.profile.Driver != "sqlite" {
		query += " FOR UPDATE"
	}
	var liveUserID int32
	if err := tx.QueryRowContext(ctx, s.encryptionQuery(query), userID).Scan(&liveUserID); err != nil {
		return ErrMemoPermissionDenied
	}
	_, err = tx.ExecContext(ctx, s.encryptionQuery("INSERT INTO encryption_vault (user_id,vault_id,revision,record) VALUES (?,?,?,?)"), userID, v.ID, v.Revision, string(data))
	if err != nil {
		return errors.Wrap(ErrEncryptionConflict, "vault creation failed")
	}
	return tx.Commit()
}

// UpdateEncryptionVault preserves identity and recovery wrapper while replacing passphrase wrappers using CAS.
func (s *Store) UpdateEncryptionVault(ctx context.Context, userID int32, data []byte, expected string) error {
	v, err := ParseVaultRecord(data)
	if err != nil {
		return err
	}
	oldData, err := s.GetEncryptionVault(ctx, userID)
	if err != nil {
		return err
	}
	old, err := ParseVaultRecord(oldData)
	if err != nil {
		return ErrEncryptionConflict
	}
	if old.ID != v.ID || old.RecoveryKey != v.RecoveryKey {
		return ErrEncryptionPolicy
	}
	if expected != old.Revision || v.Revision == old.Revision {
		return ErrEncryptionConflict
	}
	result, err := s.driver.GetDB().ExecContext(ctx, s.encryptionQuery("UPDATE encryption_vault SET record = ?, revision = ? WHERE user_id = ? AND revision = ?"), string(data), v.Revision, userID, expected)
	if err != nil {
		return err
	}
	n, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if n != 1 {
		return ErrEncryptionConflict
	}
	return nil
}

// RequirePlaintextMemo rejects unsupported operations on an immutable encrypted object.
func (s *Store) RequirePlaintextMemo(ctx context.Context, id int32) error {
	m, err := s.GetMemo(ctx, &FindMemo{ID: &id})
	if err != nil {
		return err
	}
	if IsEncryptedMemo(m) {
		return ErrEncryptionPolicy
	}
	return nil
}
func (s *Store) validateEncryptedMutation(ctx context.Context, m *MemoMutation) error {
	encrypted := IsEncryptedMemo(m.MemoCreate)
	if m.MemoCreate == nil {
		memo, err := s.GetMemo(ctx, &FindMemo{ID: &m.MemoID})
		if err != nil {
			return err
		}
		encrypted = IsEncryptedMemo(memo)
	}
	if encrypted && (m.CommentContextMemoID != nil || len(m.Bindings) > 0 || len(m.RequiredAttachmentIDs) > 0 || len(m.ReferenceRelations) > 0) {
		return ErrEncryptionPolicy
	}
	if m.CommentContextMemoID != nil {
		if err := s.RequirePlaintextMemo(ctx, *m.CommentContextMemoID); err != nil {
			return err
		}
	}
	for _, r := range m.ReferenceRelations {
		if r != nil {
			if err := s.RequirePlaintextMemo(ctx, r.RelatedMemoID); err != nil {
				return err
			}
		}
	}
	return nil
}

// ValidateEncryptedMutationEndpoints repeats immutable-kind checks in the write transaction.
func ValidateEncryptedMutationEndpoints(ctx context.Context, tx EncryptionExecutor, m *MemoMutation, postgres bool) error {
	isEncrypted := func(id int32) (bool, error) {
		var exists bool
		err := tx.QueryRowContext(ctx, encryptionSQL("SELECT EXISTS(SELECT 1 FROM memo_encryption WHERE memo_id = ?)", postgres), id).Scan(&exists)
		return exists, err
	}
	encrypted := IsEncryptedMemo(m.MemoCreate)
	if m.MemoCreate == nil {
		var err error
		encrypted, err = isEncrypted(m.MemoID)
		if err != nil {
			return err
		}
	}
	if encrypted && (m.CommentContextMemoID != nil || len(m.Bindings) > 0 || len(m.RequiredAttachmentIDs) > 0 || len(m.ReferenceRelations) > 0) {
		return ErrEncryptionPolicy
	}
	ids := []int32{}
	if m.CommentContextMemoID != nil {
		ids = append(ids, *m.CommentContextMemoID)
	}
	for _, r := range m.ReferenceRelations {
		if r != nil {
			ids = append(ids, r.RelatedMemoID)
		}
	}
	for _, id := range ids {
		encrypted, err := isEncrypted(id)
		if err != nil {
			return err
		}
		if encrypted {
			return ErrEncryptionPolicy
		}
	}
	return nil
}

// Reject duplicate JSON keys so different client/server parsers cannot disagree.
func rejectDuplicateJSONFields(decoder *json.Decoder) error {
	token, err := decoder.Token()
	if err != nil {
		return err
	}
	delim, ok := token.(json.Delim)
	if !ok {
		return nil
	}
	switch delim {
	case '{':
		seen := map[string]bool{}
		for decoder.More() {
			key, err := decoder.Token()
			if err != nil {
				return err
			}
			name, ok := key.(string)
			if !ok || seen[name] {
				return ErrEncryptionPolicy
			}
			seen[name] = true
			if err := rejectDuplicateJSONFields(decoder); err != nil {
				return err
			}
		}
	case '[':
		for decoder.More() {
			if err := rejectDuplicateJSONFields(decoder); err != nil {
				return err
			}
		}
	default:
		return ErrEncryptionPolicy
	}
	_, err = decoder.Token()
	return err
}

// Content predicates have no meaning for encrypted bodies, including negative predicates.
func hasEncryptedContentFilter(ctx context.Context, expressions []string) (bool, error) {
	if len(expressions) == 0 {
		return false, nil
	}
	engine, err := filter.DefaultEngine()
	if err != nil {
		return false, err
	}
	for _, expression := range expressions {
		program, err := engine.Compile(ctx, expression)
		if err != nil {
			return false, err
		}
		if encryptedContentField(program.ConditionTree()) {
			return true, nil
		}
	}
	return false, nil
}
func encryptedContentField(value any) bool {
	field := func(name string) bool {
		return name == "content" || name == "tags" || name == "tag" || strings.HasPrefix(name, "has_")
	}
	switch v := value.(type) {
	case *filter.LogicalCondition:
		return encryptedContentField(v.Left) || encryptedContentField(v.Right)
	case *filter.NotCondition:
		return encryptedContentField(v.Expr)
	case *filter.ComparisonCondition:
		return encryptedContentField(v.Left) || encryptedContentField(v.Right)
	case *filter.InCondition:
		return encryptedContentField(v.Left)
	case *filter.ElementInCondition:
		return field(v.Field) || encryptedContentField(v.Element)
	case *filter.FieldPredicateCondition:
		return field(v.Field)
	case *filter.TextMatchCondition:
		return field(v.Field)
	case *filter.RegexCondition:
		return field(v.Field)
	case *filter.ListComprehensionCondition:
		return field(v.Field)
	case *filter.FieldRef:
		return field(v.Name)
	case *filter.FunctionValue:
		for _, arg := range v.Args {
			if encryptedContentField(arg) {
				return true
			}
		}
	}
	return false
}
