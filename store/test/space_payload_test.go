package test

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"

	storepb "github.com/usememos/memos/proto/gen/store"
	"github.com/usememos/memos/store"
)

func TestSpacePayloadRoundTrip(t *testing.T) {
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)
	defer ts.Close()
	owner, err := createTestingHostUser(ctx, ts)
	require.NoError(t, err)
	space, err := ts.CreateSpace(ctx, &store.Space{
		UID: "icon-space", Title: "Garden",
		Payload: &storepb.SpacePayload{Icon: &storepb.SpacePayload_Icon{
			Value: &storepb.SpacePayload_Icon_Emoji{Emoji: "👩🏽‍🌾"},
		}},
	}, owner.ID)
	require.NoError(t, err)
	require.Equal(t, "👩🏽‍🌾", space.Payload.GetIcon().GetEmoji())

	for _, find := range []*store.FindSpace{{ID: &space.ID}, {MemberUserID: &owner.ID}} {
		spaces, err := ts.ListSpaces(ctx, find)
		require.NoError(t, err)
		require.Len(t, spaces, 1)
		require.Equal(t, "👩🏽‍🌾", spaces[0].Payload.GetIcon().GetEmoji())
	}
	title := "Renamed garden"
	space, err = ts.UpdateSpace(ctx, &store.UpdateSpace{ID: space.ID, Title: &title}, owner.ID)
	require.NoError(t, err)
	require.Equal(t, "👩🏽‍🌾", space.Payload.GetIcon().GetEmoji())

	space, err = ts.UpdateSpace(ctx, &store.UpdateSpace{ID: space.ID, Payload: &storepb.SpacePayload{
		Icon: &storepb.SpacePayload_Icon{Value: &storepb.SpacePayload_Icon_Lucide{Lucide: "leaf"}},
	}}, owner.ID)
	require.NoError(t, err)
	require.Equal(t, "leaf", space.Payload.GetIcon().GetLucide())
	require.Equal(t, title, space.Title)
	var raw string
	require.NoError(t, ts.GetDriver().GetDB().QueryRowContext(ctx, "SELECT payload FROM space WHERE uid = 'icon-space'").Scan(&raw))
	require.JSONEq(t, `{"icon":{"lucide":"leaf"}}`, raw)

	space, err = ts.UpdateSpace(ctx, &store.UpdateSpace{ID: space.ID, Payload: &storepb.SpacePayload{}}, owner.ID)
	require.NoError(t, err)
	require.Nil(t, space.Payload.GetIcon())
	require.NoError(t, ts.GetDriver().GetDB().QueryRowContext(ctx, "SELECT payload FROM space WHERE uid = 'icon-space'").Scan(&raw))
	require.JSONEq(t, `{}`, raw)
}

func TestMigrationSpacePayloadBackfillsDefault(t *testing.T) {
	ctx := context.Background()
	ts := NewTestingStore(ctx, t)
	defer ts.Close()
	owner, err := createTestingHostUser(ctx, ts)
	require.NoError(t, err)
	space, err := ts.CreateSpace(ctx, &store.Space{UID: "legacy-space", Title: "Legacy"}, owner.ID)
	require.NoError(t, err)
	require.NotNil(t, space.Payload)
	require.Nil(t, space.Payload.Icon)
	_, err = ts.GetDriver().GetDB().ExecContext(ctx, "ALTER TABLE space DROP COLUMN payload")
	require.NoError(t, err)
	setting, err := ts.GetInstanceBasicSetting(ctx)
	require.NoError(t, err)
	setting.SchemaVersion = "0.31.6"
	_, err = ts.UpsertInstanceSetting(ctx, &storepb.InstanceSetting{
		Key:   storepb.InstanceSettingKey_BASIC,
		Value: &storepb.InstanceSetting_BasicSetting{BasicSetting: setting},
	})
	require.NoError(t, err)
	require.NoError(t, ts.Migrate(ctx))
	space, err = ts.GetSpace(ctx, &store.FindSpace{ID: &space.ID})
	require.NoError(t, err)
	require.Equal(t, "Legacy", space.Title)
	require.NotNil(t, space.Payload)
	require.Nil(t, space.Payload.Icon)
	var raw string
	require.NoError(t, ts.GetDriver().GetDB().QueryRowContext(ctx, "SELECT payload FROM space WHERE uid = 'legacy-space'").Scan(&raw))
	require.JSONEq(t, `{}`, raw)
}
