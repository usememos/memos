package test

import (
	"context"
	"crypto/sha256"
	"fmt"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"

	storepb "github.com/usememos/memos/proto/gen/store"
	"github.com/usememos/memos/store"
)

func attachmentLookupIndex(driver string) string {
	if driver == "postgres" {
		return "idx_attachment_memo_id"
	}
	return "idx_attachment_memo_id_type"
}

// TestMigrationAttachmentIndex covers a new index, a retry after DDL committed,
// and a conflicting operator-created index without losing attachment data.
func TestMigrationAttachmentIndex(t *testing.T) {
	for _, state := range []string{"absent", "present", "conflict"} {
		t.Run(state, func(t *testing.T) {
			t.Parallel()
			ctx := context.Background()
			ts := NewTestingStore(ctx, t)
			t.Cleanup(func() { require.NoError(t, ts.Close()) })
			driver := getDriverFromEnv()
			index := attachmentLookupIndex(driver)
			user, err := createTestingHostUser(ctx, ts)
			require.NoError(t, err)
			memo, err := ts.CreateMemo(ctx, &store.Memo{UID: "index-upgrade", CreatorID: user.ID, Content: "preserved", Visibility: store.Private})
			require.NoError(t, err)
			attachment, err := ts.CreateAttachment(ctx, &store.Attachment{
				UID: "index-attachment", CreatorID: user.ID, MemoID: &memo.ID,
				Type: "image/png", Blob: []byte("preserved blob"), Size: 14, StorageType: storepb.AttachmentStorageType_ATTACHMENT_STORAGE_TYPE_UNSPECIFIED,
			})
			require.NoError(t, err)

			if state != "present" {
				query := "DROP INDEX " + index
				if driver == "mysql" {
					query += " ON attachment"
				}
				_, err = ts.GetDriver().GetDB().ExecContext(ctx, query)
				require.NoError(t, err)
			}
			if state == "conflict" {
				_, err = ts.GetDriver().GetDB().ExecContext(ctx, "CREATE INDEX "+index+" ON attachment(creator_id)")
				require.NoError(t, err)
			}
			setSchemaVersion(ctx, t, ts, "26.10.1")
			err = ts.Migrate(ctx)
			if state == "conflict" {
				require.ErrorContains(t, err, index)
			} else {
				require.NoError(t, err)
				requireLookupIndexes(ctx, t, ts, driver)
				require.NoError(t, ts.Migrate(ctx), "a completed upgrade can restart")
			}
			setting, err := ts.GetUncachedInstanceSetting(ctx, &store.FindInstanceSetting{Name: "BASIC"})
			require.NoError(t, err)
			expected := "26.11.1"
			if state == "conflict" {
				expected = "26.10.1"
			}
			require.Equal(t, expected, setting.GetBasicSetting().SchemaVersion)
			stored, err := ts.GetAttachment(ctx, &store.FindAttachment{ID: &attachment.ID, GetBlob: true})
			require.NoError(t, err)
			require.Equal(t, []byte("preserved blob"), stored.Blob)
			require.Equal(t, attachment.MemoID, stored.MemoID)
		})
	}
}

// TestMigrationAttachmentLongType preserves PostgreSQL's unbounded MIME field
// on both fresh installations and upgrades, without a B-tree entry-size failure.
func TestMigrationAttachmentLongType(t *testing.T) {
	if getDriverFromEnv() != "postgres" {
		t.Skip("PostgreSQL stores the attachment type as unbounded text")
	}
	var mime strings.Builder
	mime.WriteString("application/")
	for i := range 256 {
		fmt.Fprintf(&mime, "%x", sha256.Sum256([]byte(fmt.Sprint(i))))
	}
	for _, upgrade := range []bool{false, true} {
		t.Run(fmt.Sprintf("upgrade=%t", upgrade), func(t *testing.T) {
			ctx := context.Background()
			ts := NewTestingStore(ctx, t)
			t.Cleanup(func() { require.NoError(t, ts.Close()) })
			user, err := createTestingHostUser(ctx, ts)
			require.NoError(t, err)
			if upgrade {
				_, err := ts.GetDriver().GetDB().ExecContext(ctx, "DROP INDEX "+attachmentLookupIndex("postgres"))
				require.NoError(t, err)
				setSchemaVersion(ctx, t, ts, "26.10.1")
			}
			attachment, err := ts.CreateAttachment(ctx, &store.Attachment{UID: "long-type", CreatorID: user.ID, Type: mime.String()})
			require.NoError(t, err)
			require.NoError(t, ts.Migrate(ctx))
			requireLookupIndexes(ctx, t, ts, "postgres")
			stored, err := ts.GetAttachment(ctx, &store.FindAttachment{ID: &attachment.ID})
			require.NoError(t, err)
			require.Equal(t, mime.String(), stored.Type)
		})
	}
}
