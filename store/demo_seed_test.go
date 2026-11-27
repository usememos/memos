package store_test

import (
	"context"
	"path/filepath"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
	"golang.org/x/crypto/bcrypt"
	"google.golang.org/protobuf/proto"

	"github.com/usememos/memos/internal/profile"
	"github.com/usememos/memos/markdown"
	"github.com/usememos/memos/store"
	"github.com/usememos/memos/store/db/sqlite"
)

func newDemoStore(t *testing.T) *store.Store {
	t.Helper()
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
	require.NoError(t, stores.Migrate(context.Background()))
	return stores
}

func TestDemoSeed(t *testing.T) {
	ctx := context.Background()
	stores := newDemoStore(t)
	require.NoError(t, stores.Seed(ctx))
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
	markdownService := markdown.NewService(markdown.WithTagExtension(), markdown.WithMentionExtension())
	for _, memo := range memos {
		derived, err := markdownService.ExtractAll([]byte(memo.Content))
		require.NoError(t, err)
		require.ElementsMatch(t, derived.Tags, memo.Payload.GetTags(), "seed tags match %s", memo.UID)
		require.True(t, proto.Equal(derived.Property, memo.Payload.GetProperty()), "seed properties match %s", memo.UID)
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
	rootMemos, err := stores.ListMemos(ctx, &store.FindMemo{ExcludeComments: true})
	require.NoError(t, err)
	require.Equal(t, "welcome0000001", rootMemos[0].UID, "Explore opens with the welcome memo")

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
	for _, reaction := range reactions {
		reaction.Policy = &store.ReactionWritePolicy{ActorUserID: reaction.CreatorID}
		_, err := stores.UpsertReaction(ctx, reaction)
		require.NoError(t, err, "seed reactor can participate in memo %d", reaction.MemoID)
	}

	attachments, err := stores.ListAttachments(ctx, &store.FindAttachment{HasRelatedMemo: true})
	require.NoError(t, err)
	require.NotEmpty(t, attachments, "demo should include a memo attachment")

	// The seed holds content only: settings come
	// from the demo's declarative configuration, and no account carries a
	// seeded credential.
	notification, err := stores.GetUncachedInstanceSetting(ctx, &store.FindInstanceSetting{Name: "NOTIFICATION"})
	require.NoError(t, err)
	require.Nil(t, notification, "the seed does not set instance settings")
	userSettings, err := stores.ListUserSettings(ctx, &store.FindUserSetting{})
	require.NoError(t, err)
	require.Empty(t, userSettings, "the seed does not set user settings or access tokens")
}

func TestDemoSeedVisitorParticipation(t *testing.T) {
	ctx := context.Background()
	stores := newDemoStore(t)
	require.NoError(t, stores.Seed(ctx))
	visitor, err := stores.CreateUser(ctx, &store.User{Username: "demo-visitor", Role: store.RoleUser, PasswordHash: "hash"})
	require.NoError(t, err)

	for _, uid := range []string{"welcome0000001", "goldenhour0001", "johnnygitcheat1", "protectedintro"} {
		memo, err := stores.GetMemo(ctx, &store.FindMemo{UID: &uid})
		require.NoError(t, err)
		require.NotNil(t, memo)
		require.Nil(t, memo.SpaceID, "visitors can participate without sample Space membership")
		_, err = stores.UpsertReaction(ctx, &store.Reaction{
			CreatorID: visitor.ID, MemoID: memo.ID, ReactionType: "👍",
			Policy: &store.ReactionWritePolicy{ActorUserID: visitor.ID},
		})
		require.NoError(t, err, "new visitors can react to %s", uid)
	}
}

// The server seeds after the declarative configuration is applied, so the
// administrator may already exist: the seed keeps that row, fills only the
// profile fields left empty, and attaches its content to it.
func TestDemoSeedAttachesToDeclaredAdmin(t *testing.T) {
	ctx := context.Background()
	stores := newDemoStore(t)
	declared, err := stores.CreateUser(ctx, &store.User{Username: "steven", Role: store.RoleAdmin, Nickname: "Declared", PasswordHash: "hash"})
	require.NoError(t, err)
	require.NoError(t, stores.Seed(ctx))

	username := "steven"
	users, err := stores.ListUsers(ctx, &store.FindUser{Username: &username})
	require.NoError(t, err)
	require.Len(t, users, 1, "the seed does not create a second steven")
	require.Equal(t, declared.ID, users[0].ID)
	require.Equal(t, "Declared", users[0].Nickname, "a declared display name is kept")
	require.Equal(t, "hash", users[0].PasswordHash, "the declared credentials are kept")
	require.NotEmpty(t, users[0].Description, "an empty bio is filled from the seed")

	memos, err := stores.ListMemos(ctx, &store.FindMemo{CreatorID: &declared.ID})
	require.NoError(t, err)
	require.NotEmpty(t, memos, "the welcome memo and the rest of Steven's content belong to the declared user")
	all, err := stores.ListMemos(ctx, &store.FindMemo{})
	require.NoError(t, err)
	require.GreaterOrEqual(t, len(all), 20)
}
