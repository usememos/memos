package postgres

import (
	"context"
	"database/sql"
	"strings"

	"github.com/pkg/errors"

	storepb "github.com/usememos/memos/proto/gen/store"
	"github.com/usememos/memos/store"
)

const deleteUserBatchSize = 500

type deleteUserMemoRef struct {
	ID  int32
	UID string
}

type deleteUserTargetSet struct {
	memos           []deleteUserMemoRef
	attachments     []*store.Attachment
	attachmentIDs   []int32
	userSettingKeys []storepb.UserSetting_Key
	inboxIDs        []int32
}

func (d *DB) DeleteUser(ctx context.Context, delete *store.DeleteUser) (*store.DeleteUserResult, error) {
	tx, err := d.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, errors.Wrap(err, "failed to begin delete user transaction")
	}
	defer func() {
		_ = tx.Rollback()
	}()

	targets, err := collectDeleteUserTargets(ctx, tx, delete.ID)
	if err != nil {
		return nil, errors.Wrap(err, "failed to collect delete user targets")
	}

	if err := deleteUserTargetsTx(ctx, tx, delete.ID, targets); err != nil {
		return nil, errors.Wrap(err, "failed to delete user targets")
	}

	if store.GetDeleteUserFailpoint(ctx) == store.DeleteUserFailpointBeforeCommit {
		return nil, errors.New("delete user failpoint before commit")
	}

	if err := tx.Commit(); err != nil {
		return nil, errors.Wrap(err, "failed to commit delete user transaction")
	}

	return &store.DeleteUserResult{
		Attachments:     targets.attachments,
		UserSettingKeys: targets.userSettingKeys,
	}, nil
}

func collectDeleteUserTargets(ctx context.Context, tx *sql.Tx, userID int32) (*deleteUserTargetSet, error) {
	targets := &deleteUserTargetSet{}

	memos, err := listDeleteUserMemoTree(ctx, tx, userID)
	if err != nil {
		return nil, err
	}
	targets.memos = memos

	attachments, err := listDeleteUserAttachments(ctx, tx, userID, memoIDsFromRefs(memos))
	if err != nil {
		return nil, err
	}
	targets.attachments = attachments
	targets.attachmentIDs = attachmentIDsFromList(attachments)

	userSettingKeys, err := listDeleteUserSettingKeys(ctx, tx, userID)
	if err != nil {
		return nil, err
	}
	targets.userSettingKeys = userSettingKeys

	inboxIDs, err := listDeleteUserInboxIDs(ctx, tx, userID, memoIDSetFromRefs(memos))
	if err != nil {
		return nil, err
	}
	targets.inboxIDs = inboxIDs

	return targets, nil
}

func deleteUserTargetsTx(ctx context.Context, tx *sql.Tx, userID int32, targets *deleteUserTargetSet) error {
	memoIDs := memoIDsFromRefs(targets.memos)
	contentIDs := memoContentIDsFromRefs(targets.memos)

	if err := deleteReactionsByContentIDsTx(ctx, tx, contentIDs); err != nil {
		return err
	}
	if err := deleteAttachmentsByIDsTx(ctx, tx, targets.attachmentIDs); err != nil {
		return err
	}
	if err := deleteReactionsByCreatorTx(ctx, tx, userID); err != nil {
		return err
	}
	if err := deleteMemoSharesTx(ctx, tx, userID, memoIDs); err != nil {
		return err
	}
	if err := deleteInboxesByIDsTx(ctx, tx, targets.inboxIDs); err != nil {
		return err
	}
	if err := deleteUserIdentitiesTx(ctx, tx, userID); err != nil {
		return err
	}
	if err := deleteUserSettingsTx(ctx, tx, userID); err != nil {
		return err
	}
	if err := deleteMemoRelationsTx(ctx, tx, memoIDs); err != nil {
		return err
	}
	if err := deleteMemosTx(ctx, tx, memoIDs); err != nil {
		return err
	}
	if err := deleteUserRowTx(ctx, tx, userID); err != nil {
		return err
	}
	return nil
}

func listDeleteUserMemoTree(ctx context.Context, tx *sql.Tx, userID int32) ([]deleteUserMemoRef, error) {
	return listDeleteUserMemoTreeRecursive(ctx, tx, userID)
}

func listDeleteUserMemoTreeRecursive(ctx context.Context, tx *sql.Tx, userID int32) ([]deleteUserMemoRef, error) {
	rows, err := tx.QueryContext(ctx, `
		WITH RECURSIVE memo_tree(id, uid) AS (
			SELECT id, uid
			FROM memo
			WHERE creator_id = `+deleteUserPlaceholder(1)+`
			UNION
			SELECT child.id, child.uid
			FROM memo child
			JOIN memo_relation rel ON rel.memo_id = child.id AND rel.type = 'COMMENT'
			JOIN memo_tree parent ON rel.related_memo_id = parent.id
		)
		SELECT id, uid
		FROM memo_tree
	`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	memos := make([]deleteUserMemoRef, 0)
	for rows.Next() {
		var memo deleteUserMemoRef
		if err := rows.Scan(&memo.ID, &memo.UID); err != nil {
			return nil, err
		}
		memos = append(memos, memo)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	return memos, nil
}

func listDeleteUserAttachments(ctx context.Context, tx *sql.Tx, userID int32, memoIDs []int32) ([]*store.Attachment, error) {
	attachments := make([]*store.Attachment, 0)
	seen := make(map[int32]struct{})
	if err := appendDeleteUserAttachments(ctx, tx, `
		SELECT
			id,
			uid,
			creator_id,
			memo_id,
			storage_type,
			reference,
			payload
		FROM attachment
		WHERE creator_id = `+deleteUserPlaceholder(1), []any{userID}, seen, &attachments); err != nil {
		return nil, err
	}

	for _, batch := range deleteUserBatches(memoIDs, deleteUserBatchSize) {
		clause, args := deleteUserInClause(1, batch)
		if err := appendDeleteUserAttachments(ctx, tx, `
			SELECT
				id,
				uid,
				creator_id,
				memo_id,
				storage_type,
				reference,
				payload
			FROM attachment
			WHERE memo_id IN `+clause, args, seen, &attachments); err != nil {
			return nil, err
		}
	}

	return attachments, nil
}

func appendDeleteUserAttachments(ctx context.Context, tx *sql.Tx, query string, args []any, seen map[int32]struct{}, attachments *[]*store.Attachment) error {
	rows, err := tx.QueryContext(ctx, query, args...)
	if err != nil {
		return err
	}
	defer rows.Close()

	for rows.Next() {
		attachment := &store.Attachment{}
		var memoID sql.NullInt32
		var storageType string
		var payloadBytes []byte
		if err := rows.Scan(&attachment.ID, &attachment.UID, &attachment.CreatorID, &memoID, &storageType, &attachment.Reference, &payloadBytes); err != nil {
			return err
		}
		if _, exists := seen[attachment.ID]; exists {
			continue
		}
		seen[attachment.ID] = struct{}{}
		if memoID.Valid {
			attachment.MemoID = &memoID.Int32
		}
		attachment.StorageType = storepb.AttachmentStorageType(storepb.AttachmentStorageType_value[storageType])
		payload := &storepb.AttachmentPayload{}
		if len(payloadBytes) > 0 {
			if err := protojsonUnmarshaler.Unmarshal(payloadBytes, payload); err != nil {
				return err
			}
		}
		attachment.Payload = payload
		*attachments = append(*attachments, attachment)
	}
	return rows.Err()
}

func listDeleteUserSettingKeys(ctx context.Context, tx *sql.Tx, userID int32) ([]storepb.UserSetting_Key, error) {
	rows, err := tx.QueryContext(ctx, deleteUserSettingKeysQuery(), userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	keys := make([]storepb.UserSetting_Key, 0)
	for rows.Next() {
		var keyString string
		if err := rows.Scan(&keyString); err != nil {
			return nil, err
		}
		key := storepb.UserSetting_Key(storepb.UserSetting_Key_value[keyString])
		keys = append(keys, key)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	return keys, nil
}

func deleteUserSettingKeysQuery() string {
	return `SELECT key FROM user_setting WHERE user_id = ` + deleteUserPlaceholder(1)
}

func listDeleteUserInboxIDs(ctx context.Context, tx *sql.Tx, userID int32, memoIDSet map[int32]struct{}) ([]int32, error) {
	directIDs, err := listDeleteUserDirectInboxIDs(ctx, tx, userID)
	if err != nil {
		return nil, err
	}
	inboxIDs := append([]int32{}, directIDs...)
	if len(memoIDSet) == 0 {
		return inboxIDs, nil
	}

	memoIDs, err := listDeleteUserMemoReferencedInboxIDs(ctx, tx, userID, memoIDSet)
	if err != nil {
		return nil, err
	}
	return append(inboxIDs, memoIDs...), nil
}

func listDeleteUserDirectInboxIDs(ctx context.Context, tx *sql.Tx, userID int32) ([]int32, error) {
	rows, err := tx.QueryContext(ctx, `
		SELECT id
		FROM inbox
		WHERE sender_id = `+deleteUserPlaceholder(1)+`
			OR receiver_id = `+deleteUserPlaceholder(2), userID, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	inboxIDs := make([]int32, 0)
	for rows.Next() {
		var inboxID int32
		if err := rows.Scan(&inboxID); err != nil {
			return nil, err
		}
		inboxIDs = append(inboxIDs, inboxID)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	return inboxIDs, nil
}

func listDeleteUserMemoReferencedInboxIDs(ctx context.Context, tx *sql.Tx, userID int32, memoIDSet map[int32]struct{}) ([]int32, error) {
	rows, err := tx.QueryContext(ctx, `
		SELECT id, message
		FROM inbox
		WHERE sender_id <> `+deleteUserPlaceholder(1)+`
			AND receiver_id <> `+deleteUserPlaceholder(2), userID, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	inboxIDs := make([]int32, 0)
	for rows.Next() {
		var (
			inboxID    int32
			messageRaw []byte
		)
		if err := rows.Scan(&inboxID, &messageRaw); err != nil {
			return nil, err
		}
		if len(messageRaw) == 0 {
			continue
		}

		message := &storepb.InboxMessage{}
		if err := protojsonUnmarshaler.Unmarshal(messageRaw, message); err != nil {
			return nil, err
		}
		if inboxMessageTouchesMemoSet(message, memoIDSet) {
			inboxIDs = append(inboxIDs, inboxID)
		}
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	return inboxIDs, nil
}

func inboxMessageTouchesMemoSet(message *storepb.InboxMessage, memoIDSet map[int32]struct{}) bool {
	if message == nil {
		return false
	}

	switch message.Type {
	case storepb.InboxMessage_MEMO_COMMENT:
		payload := message.GetMemoComment()
		if payload == nil {
			return false
		}
		return memoIDInSet(payload.MemoId, memoIDSet) || memoIDInSet(payload.RelatedMemoId, memoIDSet)
	case storepb.InboxMessage_MEMO_MENTION:
		payload := message.GetMemoMention()
		if payload == nil {
			return false
		}
		return memoIDInSet(payload.MemoId, memoIDSet) || memoIDInSet(payload.RelatedMemoId, memoIDSet)
	default:
		return false
	}
}

func memoIDInSet(id int32, memoIDSet map[int32]struct{}) bool {
	if id == 0 {
		return false
	}
	_, exists := memoIDSet[id]
	return exists
}

func deleteReactionsByContentIDsTx(ctx context.Context, tx *sql.Tx, contentIDs []string) error {
	for _, batch := range deleteUserBatches(contentIDs, deleteUserBatchSize) {
		clause, args := deleteUserInClause(1, batch)
		if _, err := tx.ExecContext(ctx, `DELETE FROM reaction WHERE content_id IN `+clause, args...); err != nil {
			return err
		}
	}
	return nil
}

func deleteAttachmentsByIDsTx(ctx context.Context, tx *sql.Tx, attachmentIDs []int32) error {
	for _, batch := range deleteUserBatches(attachmentIDs, deleteUserBatchSize) {
		clause, args := deleteUserInClause(1, batch)
		if _, err := tx.ExecContext(ctx, `DELETE FROM attachment WHERE id IN `+clause, args...); err != nil {
			return err
		}
	}
	return nil
}

func deleteReactionsByCreatorTx(ctx context.Context, tx *sql.Tx, userID int32) error {
	_, err := tx.ExecContext(ctx, `DELETE FROM reaction WHERE creator_id = `+deleteUserPlaceholder(1), userID)
	return err
}

func deleteMemoSharesTx(ctx context.Context, tx *sql.Tx, userID int32, memoIDs []int32) error {
	if _, err := tx.ExecContext(ctx, `DELETE FROM memo_share WHERE creator_id = `+deleteUserPlaceholder(1), userID); err != nil {
		return err
	}
	for _, batch := range deleteUserBatches(memoIDs, deleteUserBatchSize) {
		clause, args := deleteUserInClause(1, batch)
		if _, err := tx.ExecContext(ctx, `DELETE FROM memo_share WHERE memo_id IN `+clause, args...); err != nil {
			return err
		}
	}
	return nil
}

func deleteInboxesByIDsTx(ctx context.Context, tx *sql.Tx, inboxIDs []int32) error {
	for _, batch := range deleteUserBatches(inboxIDs, deleteUserBatchSize) {
		clause, args := deleteUserInClause(1, batch)
		if _, err := tx.ExecContext(ctx, `DELETE FROM inbox WHERE id IN `+clause, args...); err != nil {
			return err
		}
	}
	return nil
}

func deleteUserIdentitiesTx(ctx context.Context, tx *sql.Tx, userID int32) error {
	_, err := tx.ExecContext(ctx, `DELETE FROM user_identity WHERE user_id = `+deleteUserPlaceholder(1), userID)
	return err
}

func deleteUserSettingsTx(ctx context.Context, tx *sql.Tx, userID int32) error {
	_, err := tx.ExecContext(ctx, `DELETE FROM user_setting WHERE user_id = `+deleteUserPlaceholder(1), userID)
	return err
}

func deleteMemoRelationsTx(ctx context.Context, tx *sql.Tx, memoIDs []int32) error {
	for _, batch := range deleteUserBatches(memoIDs, deleteUserBatchSize) {
		memoClause, args := deleteUserInClause(1, batch)
		relatedClause, relatedArgs := deleteUserInClause(len(args)+1, batch)
		query := `DELETE FROM memo_relation WHERE memo_id IN ` + memoClause + ` OR related_memo_id IN ` + relatedClause
		args = append(args, relatedArgs...)
		if _, err := tx.ExecContext(ctx, query, args...); err != nil {
			return err
		}
	}
	return nil
}

func deleteMemosTx(ctx context.Context, tx *sql.Tx, memoIDs []int32) error {
	for _, batch := range deleteUserBatches(memoIDs, deleteUserBatchSize) {
		clause, args := deleteUserInClause(1, batch)
		if _, err := tx.ExecContext(ctx, `DELETE FROM memo WHERE id IN `+clause, args...); err != nil {
			return err
		}
	}
	return nil
}

func deleteUserRowTx(ctx context.Context, tx *sql.Tx, userID int32) error {
	_, err := tx.ExecContext(ctx, `DELETE FROM "user" WHERE id = `+deleteUserPlaceholder(1), userID)
	return err
}

func deleteUserPlaceholder(index int) string {
	return placeholder(index)
}

func deleteUserInClause[T any](start int, values []T) (string, []any) {
	placeholders := make([]string, 0, len(values))
	args := make([]any, 0, len(values))
	for i, value := range values {
		placeholders = append(placeholders, deleteUserPlaceholder(start+i))
		args = append(args, value)
	}
	return "(" + strings.Join(placeholders, ", ") + ")", args
}

func deleteUserBatches[T any](values []T, size int) [][]T {
	if len(values) == 0 {
		return nil
	}
	if size <= 0 {
		size = len(values)
	}

	batches := make([][]T, 0, (len(values)+size-1)/size)
	for start := 0; start < len(values); start += size {
		end := start + size
		if end > len(values) {
			end = len(values)
		}
		batches = append(batches, values[start:end])
	}
	return batches
}

func memoIDsFromRefs(memos []deleteUserMemoRef) []int32 {
	ids := make([]int32, 0, len(memos))
	for _, memo := range memos {
		ids = append(ids, memo.ID)
	}
	return ids
}

func memoIDSetFromRefs(memos []deleteUserMemoRef) map[int32]struct{} {
	idSet := make(map[int32]struct{}, len(memos))
	for _, memo := range memos {
		idSet[memo.ID] = struct{}{}
	}
	return idSet
}

func memoContentIDsFromRefs(memos []deleteUserMemoRef) []string {
	contentIDs := make([]string, 0, len(memos))
	for _, memo := range memos {
		contentIDs = append(contentIDs, "memos/"+memo.UID)
	}
	return contentIDs
}

func attachmentIDsFromList(attachments []*store.Attachment) []int32 {
	ids := make([]int32, 0, len(attachments))
	for _, attachment := range attachments {
		if attachment == nil {
			continue
		}
		ids = append(ids, attachment.ID)
	}
	return ids
}
