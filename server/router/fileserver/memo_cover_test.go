package fileserver

import (
	"bytes"
	"context"
	"image"
	"image/png"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/labstack/echo/v5"
	"github.com/stretchr/testify/require"

	"github.com/usememos/memos/internal/testutil/fakes3"
	storepb "github.com/usememos/memos/proto/gen/store"
	"github.com/usememos/memos/server/auth"
	apiv1service "github.com/usememos/memos/server/router/api/v1"
	"github.com/usememos/memos/store"
)

func TestMemoCoverUsesMemoPermissionAndRetainsStandalonePrivacy(t *testing.T) {
	// Given a public memo referencing an owner-only cached attachment.
	ctx := context.Background()
	svc, fs, stores, cleanup := newShareAttachmentTestServices(ctx, t)
	defer cleanup()
	owner, err := stores.CreateUser(ctx, &store.User{Username: "cover-owner", Role: store.RoleUser})
	require.NoError(t, err)
	other, err := stores.CreateUser(ctx, &store.User{Username: "cover-other", Role: store.RoleUser})
	require.NoError(t, err)
	cover, err := stores.CreateAttachment(ctx, &store.Attachment{
		UID: "memo-cover", CreatorID: owner.ID, Filename: "link-cover-test", Type: "image/png", Blob: []byte("cover bytes"),
	})
	require.NoError(t, err)
	memo, err := stores.CreateMemo(ctx, &store.Memo{
		UID: "cover-memo", CreatorID: owner.ID, Visibility: store.Public,
		Payload: &storepb.MemoPayload{Links: []*storepb.MemoPayload_LinkMetadata{{CoverAttachmentUid: cover.UID}}},
	})
	require.NoError(t, err)
	e := echo.New()
	fs.RegisterRoutes(e)
	path := "/file/memos/" + memo.UID + "/covers/" + cover.UID
	request := func(path string, user *store.User) *httptest.ResponseRecorder {
		t.Helper()
		req := httptest.NewRequest(http.MethodGet, path, nil)
		if user != nil {
			token, _, err := auth.GenerateAccessTokenV2(user.ID, user.Username, string(user.Role), string(user.RowStatus), []byte(svc.Secret))
			require.NoError(t, err)
			req.Header.Set("Authorization", "Bearer "+token)
		}
		recorder := httptest.NewRecorder()
		e.ServeHTTP(recorder, req)
		return recorder
	}

	// When reading through the memo route or the old standalone route.
	public := request(path, nil)
	standalone := request("/file/attachments/"+cover.UID, nil)
	// Then the memo route permits the exact public reference, without shared caching.
	require.Equal(t, http.StatusOK, public.Code)
	require.Equal(t, "cover bytes", public.Body.String())
	require.Equal(t, "private, no-store", public.Header().Get("Cache-Control"))
	require.Equal(t, http.StatusUnauthorized, standalone.Code)
	require.Equal(t, http.StatusNotFound, request(path+"-guessed", nil).Code)
	setInstanceAccessMode(ctx, t, stores, storepb.InstanceAccessMode_INSTANCE_ACCESS_MODE_PRIVATE)
	require.Equal(t, http.StatusUnauthorized, request(path, nil).Code)
	setInstanceAccessMode(ctx, t, stores, storepb.InstanceAccessMode_INSTANCE_ACCESS_MODE_PUBLIC)

	private := store.Private
	require.NoError(t, stores.UpdateMemo(ctx, &store.UpdateMemo{ID: memo.ID, Visibility: &private}))
	require.Equal(t, http.StatusUnauthorized, request(path, nil).Code)
	require.Equal(t, http.StatusForbidden, request(path, other).Code)
	require.Equal(t, http.StatusOK, request(path, owner).Code)
	share, err := stores.CreateMemoShare(ctx, &store.MemoShare{UID: "cover-share", MemoID: memo.ID, CreatorID: owner.ID})
	require.NoError(t, err)
	require.Equal(t, http.StatusOK, request(path+"?share_token="+share.UID, nil).Code)
	expired := time.Now().Add(-time.Hour).Unix()
	_, err = stores.CreateMemoShare(ctx, &store.MemoShare{UID: "expired-cover-share", MemoID: memo.ID, CreatorID: owner.ID, ExpiresTs: &expired})
	require.NoError(t, err)
	require.Equal(t, http.StatusUnauthorized, request(path+"?share_token=expired-cover-share", nil).Code)
	require.NoError(t, stores.UpdateMemo(ctx, &store.UpdateMemo{ID: memo.ID, Payload: &storepb.MemoPayload{}}))
	require.Equal(t, http.StatusNotFound, request(path+"?share_token="+share.UID, nil).Code)

	space, err := stores.CreateSpace(ctx, &store.Space{UID: "cover-space", Title: "Covers"}, owner.ID)
	require.NoError(t, err)
	_, err = stores.CreateSpaceInvitation(ctx, &store.SpaceInvitation{SpaceID: space.ID, UserID: other.ID, Role: store.SpaceMemberRoleUser}, owner.ID)
	require.NoError(t, err)
	spaceMemo, err := stores.CreateMemo(ctx, &store.Memo{
		UID: "space-cover-memo", CreatorID: owner.ID, SpaceID: &space.ID, Visibility: store.SpaceAudience,
		Payload: &storepb.MemoPayload{Links: []*storepb.MemoPayload_LinkMetadata{{CoverAttachmentUid: cover.UID}}},
	})
	require.NoError(t, err)
	spacePath := "/file/memos/" + spaceMemo.UID + "/covers/" + cover.UID
	require.Equal(t, http.StatusForbidden, request(spacePath, other).Code)
	_, err = stores.AcceptSpaceInvitation(ctx, &store.AcceptSpaceInvitation{SpaceID: space.ID, UserID: other.ID}, other.ID)
	require.NoError(t, err)
	require.Equal(t, http.StatusOK, request(spacePath, other).Code)
	require.Equal(t, http.StatusUnauthorized, request(spacePath+"?share_token="+share.UID, nil).Code)
	require.NoError(t, stores.DeleteSpaceMember(ctx, &store.DeleteSpaceMember{SpaceID: space.ID, UserID: other.ID}, owner.ID))
	require.Equal(t, http.StatusForbidden, request(spacePath, other).Code)
}

func TestMemoCoverManagedStorageKeepsPrivateCacheHeaders(t *testing.T) {
	for _, kind := range []string{"local", "s3"} {
		t.Run(kind, func(t *testing.T) {
			ctx := context.Background()
			_, fs, stores, cleanup := newShareAttachmentTestServices(ctx, t)
			defer cleanup()
			configured := &storepb.Storage{Id: "covers", Name: "Covers", Type: storepb.StorageType_STORAGE_TYPE_LOCAL}
			if kind == "s3" {
				fake := fakes3.New(t, "covers")
				configured.Type = storepb.StorageType_STORAGE_TYPE_S3
				configured.Config = &storepb.Storage_S3Config{S3Config: fake.Config("covers")}
			}
			_, err := stores.UpsertInstanceSetting(ctx, &storepb.InstanceSetting{Key: storepb.InstanceSettingKey_STORAGE,
				Value: &storepb.InstanceSetting_StorageSetting{StorageSetting: &storepb.InstanceStorageSetting{
					FilepathTemplate: "{filename}", Storages: []*storepb.Storage{configured}, DefaultStorageId: configured.Id,
				}},
			})
			require.NoError(t, err)
			owner, err := stores.CreateUser(ctx, &store.User{Username: "managed-cover-owner", Role: store.RoleUser})
			require.NoError(t, err)
			var encoded bytes.Buffer
			require.NoError(t, png.Encode(&encoded, image.NewNRGBA(image.Rect(0, 0, 16, 16))))
			cover := &store.Attachment{UID: "managed-cover", CreatorID: owner.ID, Filename: "link-cover.png", Type: "image/png", Blob: encoded.Bytes(), Size: int64(encoded.Len())}
			require.NoError(t, apiv1service.SaveAttachmentBlob(ctx, fs.Profile, stores, cover))
			cover, err = stores.CreateAttachment(ctx, cover)
			require.NoError(t, err)
			memo, err := stores.CreateMemo(ctx, &store.Memo{UID: "managed-memo", CreatorID: owner.ID, Visibility: store.Public,
				Payload: &storepb.MemoPayload{Links: []*storepb.MemoPayload_LinkMetadata{{CoverAttachmentUid: cover.UID}}},
			})
			require.NoError(t, err)
			e := echo.New()
			fs.RegisterRoutes(e)
			path := "/file/memos/" + memo.UID + "/covers/" + cover.UID
			request := func(suffix string, headers map[string]string) *httptest.ResponseRecorder {
				req := httptest.NewRequest(http.MethodGet, path+suffix, nil)
				for name, value := range headers {
					req.Header.Set(name, value)
				}
				response := httptest.NewRecorder()
				e.ServeHTTP(response, req)
				require.Equal(t, "private, no-store", response.Header().Get("Cache-Control"))
				return response
			}
			full := request("", nil)
			require.Equal(t, http.StatusOK, full.Code)
			require.Equal(t, encoded.Bytes(), full.Body.Bytes())
			partial := request("", map[string]string{"Range": "bytes=0-7"})
			require.Equal(t, http.StatusPartialContent, partial.Code)
			require.Equal(t, encoded.Bytes()[:8], partial.Body.Bytes())
			thumbnail := request("?thumbnail=true", nil)
			require.Equal(t, http.StatusOK, thumbnail.Code)
			_, _, err = image.Decode(bytes.NewReader(thumbnail.Body.Bytes()))
			require.NoError(t, err)
			if kind == "local" {
				conditional := request("", map[string]string{"If-Modified-Since": full.Header().Get("Last-Modified")})
				require.Equal(t, http.StatusNotModified, conditional.Code)
			}
			private := store.Private
			require.NoError(t, stores.UpdateMemo(ctx, &store.UpdateMemo{ID: memo.ID, Visibility: &private}))
			require.Equal(t, http.StatusUnauthorized, request("", nil).Code)
			require.Equal(t, http.StatusUnauthorized, request("?thumbnail=true", nil).Code)
		})
	}
}
