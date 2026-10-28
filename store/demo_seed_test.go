package store_test

import (
	"context"
	"path/filepath"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
	"golang.org/x/crypto/bcrypt"

	"github.com/usememos/memos/internal/profile"
	"github.com/usememos/memos/store"
	"github.com/usememos/memos/store/db/sqlite"
)

func TestDemoSeed(t *testing.T) {
	ctx := context.Background()
	p := &profile.Profile{
		Demo:   true,
		Data:   t.TempDir(),
		Driver: "sqlite",
		DSN:    filepath.Join(t.TempDir(), "demo.db"),
	}
	driver, err := sqlite.NewDB(p)
	require.NoError(t, err)
	stores := store.New(driver, p)
	t.Cleanup(func() {
		require.NoError(t, stores.Close())
	})

	require.NoError(t, stores.Migrate(ctx))
	generalSetting, err := stores.GetInstanceGeneralSetting(ctx)
	require.NoError(t, err)
	require.False(t, generalSetting.DisallowPasswordAuth, "the demo seed does not set an authentication policy")
	require.False(t, generalSetting.DisallowUserRegistration, "SSO first-login provisioning must remain enabled")

	adminUsername := "steven"
	adminUser, err := stores.GetUser(ctx, &store.FindUser{Username: &adminUsername})
	require.NoError(t, err)
	require.NotNil(t, adminUser)
	require.Equal(t, store.RoleAdmin, adminUser.Role)
	require.Error(t, bcrypt.CompareHashAndPassword([]byte(adminUser.PasswordHash), []byte("demo")))
	adminCost, err := bcrypt.Cost([]byte(adminUser.PasswordHash))
	require.NoError(t, err)
	require.GreaterOrEqual(t, adminCost, 12)

	johnnyUsername := "johnny"
	johnnyUser, err := stores.GetUser(ctx, &store.FindUser{Username: &johnnyUsername})
	require.NoError(t, err)
	require.NotNil(t, johnnyUser)
	require.Error(t, bcrypt.CompareHashAndPassword([]byte(johnnyUser.PasswordHash), []byte("demo")))
	require.NotEqual(t, adminUser.PasswordHash, johnnyUser.PasswordHash)

	memos, err := stores.ListMemos(ctx, &store.FindMemo{})
	require.NoError(t, err)
	require.GreaterOrEqual(t, len(memos), 20)

	var hasPublic, hasProtected, hasLocation, hasNestedTag, hasMention bool
	for _, memo := range memos {
		hasPublic = hasPublic || memo.Visibility == store.Public
		hasProtected = hasProtected || memo.Visibility == store.Protected
		hasLocation = hasLocation || memo.Payload.GetLocation() != nil
		for _, tag := range memo.Payload.GetTags() {
			hasNestedTag = hasNestedTag || strings.Contains(tag, "/")
		}
		hasMention = hasMention || strings.Contains(memo.Content, "@steven")
	}
	require.True(t, hasPublic, "demo should include public memos")
	require.True(t, hasProtected, "demo should include protected memos")
	require.True(t, hasLocation, "demo should include location metadata")
	require.True(t, hasNestedTag, "demo should include nested tags")
	require.True(t, hasMention, "demo should include a mention")

	relations, err := stores.ListMemoRelations(ctx, &store.FindMemoRelation{})
	require.NoError(t, err)
	var hasComment, hasReference bool
	for _, relation := range relations {
		hasComment = hasComment || relation.Type == store.MemoRelationComment
		hasReference = hasReference || relation.Type == store.MemoRelationReference
	}
	require.True(t, hasComment, "demo should include comments")
	require.True(t, hasReference, "demo should include memo references")

	reactions, err := stores.ListReactions(ctx, &store.FindReaction{})
	require.NoError(t, err)
	require.NotEmpty(t, reactions, "demo should include reactions")

	attachments, err := stores.ListAttachments(ctx, &store.FindAttachment{HasRelatedMemo: true})
	require.NoError(t, err)
	require.NotEmpty(t, attachments, "demo should include a memo attachment")
}
