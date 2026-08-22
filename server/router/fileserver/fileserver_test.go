package fileserver

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/binary"
	"fmt"
	"hash/crc32"
	"image"
	"image/color"
	"image/png"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/labstack/echo/v5"
	"github.com/stretchr/testify/require"
	"google.golang.org/protobuf/types/known/fieldmaskpb"
	"google.golang.org/protobuf/types/known/timestamppb"

	"github.com/usememos/memos/internal/markdown"
	"github.com/usememos/memos/internal/profile"
	"github.com/usememos/memos/internal/testutil"
	"github.com/usememos/memos/internal/testutil/fakes3"
	testminio "github.com/usememos/memos/internal/testutil/minio"
	"github.com/usememos/memos/internal/util"
	apiv1 "github.com/usememos/memos/proto/gen/api/v1"
	storepb "github.com/usememos/memos/proto/gen/store"
	"github.com/usememos/memos/server/auth"
	apiv1service "github.com/usememos/memos/server/router/api/v1"
	"github.com/usememos/memos/store"
	teststore "github.com/usememos/memos/store/test"
)

func TestServeAttachmentFile_S3(t *testing.T) {
	ctx := context.Background()
	fake := fakes3.New(t, "file-server-attachments")
	svc, fs, stores, cleanup := newShareAttachmentTestServices(ctx, t)
	defer cleanup()

	configuredStorage := &storepb.Storage{
		Id:     "s3-files",
		Name:   "File server S3",
		Type:   storepb.StorageType_STORAGE_TYPE_S3,
		Config: &storepb.Storage_S3Config{S3Config: fake.Config("file-server-attachments")},
	}
	_, err := stores.UpsertInstanceSetting(ctx, &storepb.InstanceSetting{
		Key: storepb.InstanceSettingKey_STORAGE,
		Value: &storepb.InstanceSetting_StorageSetting{StorageSetting: &storepb.InstanceStorageSetting{
			FilepathTemplate:  "files/{uuid}_{filename}",
			UploadSizeLimitMb: 30,
			Storages:          []*storepb.Storage{configuredStorage},
			DefaultStorageId:  configuredStorage.Id,
		}},
	})
	require.NoError(t, err)

	creator, err := stores.CreateUser(ctx, &store.User{
		Username: "s3-file-owner",
		Role:     store.RoleUser,
		Email:    "s3-file-owner@example.com",
	})
	require.NoError(t, err)
	creatorCtx := context.WithValue(ctx, auth.UserIDContextKey, creator.ID)
	content := []byte("content streamed from S3")
	attachment, err := svc.CreateAttachment(creatorCtx, &apiv1.CreateAttachmentRequest{Attachment: &apiv1.Attachment{
		Filename: "document.txt",
		Type:     "text/plain",
		Content:  content,
	}})
	require.NoError(t, err)
	_, err = svc.CreateMemo(creatorCtx, &apiv1.CreateMemoRequest{Memo: &apiv1.Memo{
		Content:     "public S3 attachment",
		Visibility:  apiv1.Visibility_PUBLIC,
		Attachments: []*apiv1.Attachment{{Name: attachment.Name}},
	}})
	require.NoError(t, err)

	e := echo.New()
	fs.RegisterRoutes(e)
	recorder := httptest.NewRecorder()
	e.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, fmt.Sprintf("/file/%s/%s", attachment.Name, attachment.Filename), nil))

	require.Equal(t, http.StatusOK, recorder.Code)
	require.Equal(t, content, recorder.Body.Bytes())
	require.Equal(t, "text/plain; charset=utf-8", recorder.Header().Get(echo.HeaderContentType))

	// S3 cannot produce multipart range responses. The fileserver may ignore a
	// Range request and send the complete representation instead of forwarding
	// a request the backend rejects.
	multiRangeRequest := httptest.NewRequest(http.MethodGet, fmt.Sprintf("/file/%s/%s", attachment.Name, attachment.Filename), nil)
	multiRangeRequest.Header.Set("Range", "bytes=0-2,5-7")
	multiRangeRecorder := httptest.NewRecorder()
	e.ServeHTTP(multiRangeRecorder, multiRangeRequest)
	require.Equal(t, http.StatusOK, multiRangeRecorder.Code)
	require.Equal(t, content, multiRangeRecorder.Body.Bytes())
	require.Empty(t, multiRangeRecorder.Header().Get("Content-Range"))
}

func TestServeAttachmentFile_S3MinIO(t *testing.T) {
	ctx := context.Background()
	server := testminio.New(t, "file-server-attachments")
	svc, fs, stores, cleanup := newShareAttachmentTestServices(ctx, t)
	defer cleanup()

	configuredStorage := &storepb.Storage{
		Id:     "s3-minio-files",
		Name:   "MinIO files",
		Type:   storepb.StorageType_STORAGE_TYPE_S3,
		Config: &storepb.Storage_S3Config{S3Config: server.Config("file-server-attachments")},
	}
	_, err := stores.UpsertInstanceSetting(ctx, &storepb.InstanceSetting{
		Key: storepb.InstanceSettingKey_STORAGE,
		Value: &storepb.InstanceSetting_StorageSetting{StorageSetting: &storepb.InstanceStorageSetting{
			FilepathTemplate:  "files/{uuid}_{filename}",
			UploadSizeLimitMb: 30,
			Storages:          []*storepb.Storage{configuredStorage},
			DefaultStorageId:  configuredStorage.Id,
		}},
	})
	require.NoError(t, err)

	creator, err := stores.CreateUser(ctx, &store.User{
		Username: "s3-minio-file-owner",
		Role:     store.RoleUser,
		Email:    "s3-minio-file-owner@example.com",
	})
	require.NoError(t, err)
	creatorCtx := context.WithValue(ctx, auth.UserIDContextKey, creator.ID)
	textContent := []byte("content streamed through Memos from MinIO")
	textAttachment, err := svc.CreateAttachment(creatorCtx, &apiv1.CreateAttachmentRequest{Attachment: &apiv1.Attachment{
		Filename: "document.txt",
		Type:     "text/plain",
		Content:  textContent,
	}})
	require.NoError(t, err)
	videoContent := []byte("0123456789abcdef")
	videoAttachment, err := svc.CreateAttachment(creatorCtx, &apiv1.CreateAttachmentRequest{Attachment: &apiv1.Attachment{
		Filename: "clip.mp4",
		Type:     "video/mp4",
		Content:  videoContent,
	}})
	require.NoError(t, err)
	_, err = svc.CreateMemo(creatorCtx, &apiv1.CreateMemoRequest{Memo: &apiv1.Memo{
		Content:    "public MinIO attachments",
		Visibility: apiv1.Visibility_PUBLIC,
		Attachments: []*apiv1.Attachment{
			{Name: textAttachment.Name},
			{Name: videoAttachment.Name},
		},
	}})
	require.NoError(t, err)

	e := echo.New()
	fs.RegisterRoutes(e)
	textURL := fmt.Sprintf("/file/%s/%s", textAttachment.Name, textAttachment.Filename)

	// Authorization happens before storage resolution, so a private instance
	// must not expose object bytes.
	setInstanceAccessMode(ctx, t, stores, storepb.InstanceAccessMode_INSTANCE_ACCESS_MODE_PRIVATE)
	privateRecorder := httptest.NewRecorder()
	e.ServeHTTP(privateRecorder, httptest.NewRequest(http.MethodGet, textURL, nil))
	require.Equal(t, http.StatusUnauthorized, privateRecorder.Code)
	require.Empty(t, privateRecorder.Header().Get(echo.HeaderLocation))

	setInstanceAccessMode(ctx, t, stores, storepb.InstanceAccessMode_INSTANCE_ACCESS_MODE_PUBLIC)
	textRecorder := httptest.NewRecorder()
	e.ServeHTTP(textRecorder, httptest.NewRequest(http.MethodGet, textURL, nil))
	require.Equal(t, http.StatusOK, textRecorder.Code)
	require.Equal(t, textContent, textRecorder.Body.Bytes())

	// A migrated key-only attachment carries the legacy "s3" ID. If the
	// registry was rebuilt with a different ID, the resolver must still fall
	// back to the migrated singleton configuration and serve the original key.
	textUID, err := apiv1service.ExtractAttachmentUIDFromName(textAttachment.Name)
	require.NoError(t, err)
	storedTextAttachment, err := stores.GetAttachment(ctx, &store.FindAttachment{UID: &textUID})
	require.NoError(t, err)
	require.NotNil(t, storedTextAttachment)
	storedTextAttachment.Payload.GetS3Object().StorageId = "s3"
	require.NoError(t, stores.UpdateAttachment(ctx, &store.UpdateAttachment{
		ID:      storedTextAttachment.ID,
		Payload: storedTextAttachment.Payload,
	}))
	legacyRecorder := httptest.NewRecorder()
	e.ServeHTTP(legacyRecorder, httptest.NewRequest(http.MethodGet, textURL, nil))
	require.Equal(t, http.StatusOK, legacyRecorder.Code)
	require.Equal(t, textContent, legacyRecorder.Body.Bytes())

	// Media is proxied through the server instead of redirecting to a
	// presigned URL, with the Range header forwarded for seeking.
	videoURL := fmt.Sprintf("/file/%s/%s", videoAttachment.Name, videoAttachment.Filename)
	videoRecorder := httptest.NewRecorder()
	e.ServeHTTP(videoRecorder, httptest.NewRequest(http.MethodGet, videoURL, nil))
	require.Equal(t, http.StatusOK, videoRecorder.Code)
	require.Equal(t, videoContent, videoRecorder.Body.Bytes())
	require.Equal(t, "bytes", videoRecorder.Header().Get("Accept-Ranges"))
	require.Equal(t, fmt.Sprintf("%d", len(videoContent)), videoRecorder.Header().Get(echo.HeaderContentLength))

	rangeRecorder := httptest.NewRecorder()
	rangeRequest := httptest.NewRequest(http.MethodGet, videoURL, nil)
	rangeRequest.Header.Set("Range", "bytes=4-7")
	e.ServeHTTP(rangeRecorder, rangeRequest)
	require.Equal(t, http.StatusPartialContent, rangeRecorder.Code)
	require.Equal(t, []byte("4567"), rangeRecorder.Body.Bytes())
	require.Equal(t, fmt.Sprintf("bytes 4-7/%d", len(videoContent)), rangeRecorder.Header().Get("Content-Range"))

	invalidRangeRecorder := httptest.NewRecorder()
	invalidRangeRequest := httptest.NewRequest(http.MethodGet, videoURL, nil)
	invalidRangeRequest.Header.Set("Range", fmt.Sprintf("bytes=%d-", len(videoContent)*2))
	e.ServeHTTP(invalidRangeRecorder, invalidRangeRequest)
	require.Equal(t, http.StatusRequestedRangeNotSatisfiable, invalidRangeRecorder.Code)
	require.Equal(t, fmt.Sprintf("bytes */%d", len(videoContent)), invalidRangeRecorder.Header().Get("Content-Range"))
}

func TestServeAttachmentFile_ShareTokenAllowsDirectMemoAttachment(t *testing.T) {
	ctx := context.Background()
	svc, fs, stores, cleanup := newShareAttachmentTestServices(ctx, t)
	defer cleanup()

	creator, err := svc.Store.CreateUser(ctx, &store.User{
		Username: "share-parent-owner",
		Role:     store.RoleUser,
		Email:    "share-parent-owner@example.com",
	})
	require.NoError(t, err)

	creatorCtx := context.WithValue(ctx, auth.UserIDContextKey, creator.ID)

	attachment, err := svc.CreateAttachment(creatorCtx, &apiv1.CreateAttachmentRequest{
		Attachment: &apiv1.Attachment{
			Filename: "memo.txt",
			Type:     "text/plain",
			Content:  []byte("memo attachment"),
		},
	})
	require.NoError(t, err)

	parentMemo, err := svc.CreateMemo(creatorCtx, &apiv1.CreateMemoRequest{
		Memo: &apiv1.Memo{
			Content:    "shared parent",
			Visibility: apiv1.Visibility_PROTECTED,
			Attachments: []*apiv1.Attachment{
				{Name: attachment.Name},
			},
		},
	})
	require.NoError(t, err)

	share, err := svc.CreateMemoShare(creatorCtx, &apiv1.CreateMemoShareRequest{
		Parent:    parentMemo.Name,
		MemoShare: &apiv1.MemoShare{},
	})
	require.NoError(t, err)
	shareToken := share.Name[strings.LastIndex(share.Name, "/")+1:]

	e := echo.New()
	fs.RegisterRoutes(e)

	req := httptest.NewRequest(http.MethodGet, fmt.Sprintf("/file/%s/%s?share_token=%s", attachment.Name, attachment.Filename, shareToken), nil)
	req.AddCookie(newExpiredRefreshTokenCookie(ctx, t, stores, creator.ID, svc.Secret))
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)

	require.Equal(t, http.StatusOK, rec.Code)
	require.Equal(t, "memo attachment", rec.Body.String())
}

func TestServeAttachmentFile_CanonicalRouteAndVisibilityAwareCache(t *testing.T) {
	ctx := context.Background()
	svc, fs, _, cleanup := newShareAttachmentTestServices(ctx, t)
	defer cleanup()

	creator, err := svc.Store.CreateUser(ctx, &store.User{
		Username: "canonical-route-owner",
		Role:     store.RoleUser,
		Email:    "canonical-route-owner@example.com",
	})
	require.NoError(t, err)
	creatorCtx := context.WithValue(ctx, auth.UserIDContextKey, creator.ID)
	attachment, err := svc.CreateAttachment(creatorCtx, &apiv1.CreateAttachmentRequest{Attachment: &apiv1.Attachment{
		Filename: "canonical.png",
		Type:     "image/png",
		Content:  []byte("canonical image"),
	}})
	require.NoError(t, err)
	memo, err := svc.CreateMemo(creatorCtx, &apiv1.CreateMemoRequest{Memo: &apiv1.Memo{
		Content:     "canonical route",
		Visibility:  apiv1.Visibility_PUBLIC,
		Attachments: []*apiv1.Attachment{{Name: attachment.Name}},
	}})
	require.NoError(t, err)

	e := echo.New()
	fs.RegisterRoutes(e)
	url := "/file/" + attachment.Name
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, url, nil))
	require.Equal(t, http.StatusOK, rec.Code)
	require.Equal(t, "canonical image", rec.Body.String())
	require.Equal(t, publicAttachmentCacheControl, rec.Header().Get(echo.HeaderCacheControl))

	_, err = svc.UpdateMemo(creatorCtx, &apiv1.UpdateMemoRequest{
		Memo:       &apiv1.Memo{Name: memo.Name, Visibility: apiv1.Visibility_PROTECTED},
		UpdateMask: &fieldmaskpb.FieldMask{Paths: []string{"visibility"}},
	})
	require.NoError(t, err)
	rec = httptest.NewRecorder()
	e.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, url, nil))
	require.Equal(t, http.StatusUnauthorized, rec.Code)
	require.Equal(t, privateAttachmentCacheControl, rec.Header().Get(echo.HeaderCacheControl))
}

func TestServeAttachmentFile_CommentFollowsCurrentParentVisibility(t *testing.T) {
	ctx := context.Background()
	svc, fs, _, cleanup := newShareAttachmentTestServices(ctx, t)
	defer cleanup()

	owner, err := svc.Store.CreateUser(ctx, &store.User{Username: "comment-parent-owner", Role: store.RoleUser, Email: "parent@example.com"})
	require.NoError(t, err)
	commenter, err := svc.Store.CreateUser(ctx, &store.User{Username: "comment-file-owner", Role: store.RoleUser, Email: "commenter@example.com"})
	require.NoError(t, err)
	ownerCtx := context.WithValue(ctx, auth.UserIDContextKey, owner.ID)
	commenterCtx := context.WithValue(ctx, auth.UserIDContextKey, commenter.ID)
	parent, err := svc.CreateMemo(ownerCtx, &apiv1.CreateMemoRequest{Memo: &apiv1.Memo{Content: "parent", Visibility: apiv1.Visibility_PUBLIC}})
	require.NoError(t, err)
	attachment, err := svc.CreateAttachment(commenterCtx, &apiv1.CreateAttachmentRequest{Attachment: &apiv1.Attachment{
		Filename: "comment.png",
		Type:     "image/png",
		Content:  []byte("comment image"),
	}})
	require.NoError(t, err)
	_, err = svc.CreateMemoComment(commenterCtx, &apiv1.CreateMemoCommentRequest{
		Name: parent.Name,
		Comment: &apiv1.Memo{
			Content:     "comment",
			Attachments: []*apiv1.Attachment{{Name: attachment.Name}},
		},
	})
	require.NoError(t, err)

	e := echo.New()
	fs.RegisterRoutes(e)
	url := "/file/" + attachment.Name
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, url, nil))
	require.Equal(t, http.StatusOK, rec.Code)

	_, err = svc.UpdateMemo(ownerCtx, &apiv1.UpdateMemoRequest{
		Memo:       &apiv1.Memo{Name: parent.Name, Visibility: apiv1.Visibility_PRIVATE},
		UpdateMask: &fieldmaskpb.FieldMask{Paths: []string{"visibility"}},
	})
	require.NoError(t, err)
	rec = httptest.NewRecorder()
	e.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, url, nil))
	require.Equal(t, http.StatusUnauthorized, rec.Code)
	require.Equal(t, privateAttachmentCacheControl, rec.Header().Get(echo.HeaderCacheControl))
}

func TestServeAttachmentFile_LocalStaticFileSupportsRangeRequests(t *testing.T) {
	ctx := context.Background()
	svc, fs, _, cleanup := newShareAttachmentTestServices(ctx, t)
	defer cleanup()

	creator, err := svc.Store.CreateUser(ctx, &store.User{
		Username: "range-owner",
		Role:     store.RoleUser,
		Email:    "range-owner@example.com",
	})
	require.NoError(t, err)
	creatorCtx := context.WithValue(ctx, auth.UserIDContextKey, creator.ID)

	attachment, err := svc.CreateAttachment(creatorCtx, &apiv1.CreateAttachmentRequest{
		Attachment: &apiv1.Attachment{
			Filename: "range.txt",
			Type:     "text/plain",
			Content:  []byte("0123456789"),
		},
	})
	require.NoError(t, err)

	_, err = svc.CreateMemo(creatorCtx, &apiv1.CreateMemoRequest{
		Memo: &apiv1.Memo{
			Content:    "range memo",
			Visibility: apiv1.Visibility_PUBLIC,
			Attachments: []*apiv1.Attachment{
				{Name: attachment.Name},
			},
		},
	})
	require.NoError(t, err)

	e := echo.New()
	fs.RegisterRoutes(e)

	req := httptest.NewRequest(http.MethodGet, fmt.Sprintf("/file/%s/%s", attachment.Name, attachment.Filename), nil)
	req.Header.Set("Range", "bytes=2-5")
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)

	require.Equal(t, http.StatusPartialContent, rec.Code)
	require.Equal(t, "2345", rec.Body.String())
	require.Equal(t, "bytes 2-5/10", rec.Header().Get("Content-Range"))
}

func TestServeAttachmentFile_ShareTokenRejectsCommentAttachment(t *testing.T) {
	ctx := context.Background()
	svc, fs, _, cleanup := newShareAttachmentTestServices(ctx, t)
	defer cleanup()

	creator, err := svc.Store.CreateUser(ctx, &store.User{
		Username: "private-parent-owner",
		Role:     store.RoleUser,
		Email:    "private-parent-owner@example.com",
	})
	require.NoError(t, err)

	creatorCtx := context.WithValue(ctx, auth.UserIDContextKey, creator.ID)
	commenter, err := svc.Store.CreateUser(ctx, &store.User{
		Username: "share-commenter",
		Role:     store.RoleUser,
		Email:    "share-commenter@example.com",
	})
	require.NoError(t, err)
	commenterCtx := context.WithValue(ctx, auth.UserIDContextKey, commenter.ID)

	parentMemo, err := svc.CreateMemo(creatorCtx, &apiv1.CreateMemoRequest{
		Memo: &apiv1.Memo{
			Content:    "shared parent",
			Visibility: apiv1.Visibility_PROTECTED,
		},
	})
	require.NoError(t, err)

	commentAttachment, err := svc.CreateAttachment(commenterCtx, &apiv1.CreateAttachmentRequest{
		Attachment: &apiv1.Attachment{
			Filename: "comment.txt",
			Type:     "text/plain",
			Content:  []byte("comment attachment"),
		},
	})
	require.NoError(t, err)

	_, err = svc.CreateMemoComment(commenterCtx, &apiv1.CreateMemoCommentRequest{
		Name: parentMemo.Name,
		Comment: &apiv1.Memo{
			Content:    "comment with attachment",
			Visibility: apiv1.Visibility_PROTECTED,
			Attachments: []*apiv1.Attachment{
				{Name: commentAttachment.Name},
			},
		},
	})
	require.NoError(t, err)

	share, err := svc.CreateMemoShare(creatorCtx, &apiv1.CreateMemoShareRequest{
		Parent:    parentMemo.Name,
		MemoShare: &apiv1.MemoShare{},
	})
	require.NoError(t, err)
	shareToken := share.Name[strings.LastIndex(share.Name, "/")+1:]

	e := echo.New()
	fs.RegisterRoutes(e)

	req := httptest.NewRequest(http.MethodGet, fmt.Sprintf("/file/%s/%s?share_token=%s", commentAttachment.Name, commentAttachment.Filename, shareToken), nil)
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)

	require.Equal(t, http.StatusUnauthorized, rec.Code)
}

func TestServeAttachmentFile_MotionClip(t *testing.T) {
	ctx := context.Background()
	svc, fs, _, cleanup := newShareAttachmentTestServices(ctx, t)
	defer cleanup()

	creator, err := svc.Store.CreateUser(ctx, &store.User{
		Username: "motion-owner",
		Role:     store.RoleUser,
		Email:    "motion-owner@example.com",
	})
	require.NoError(t, err)
	creatorCtx := context.WithValue(ctx, auth.UserIDContextKey, creator.ID)

	attachment, err := svc.CreateAttachment(creatorCtx, &apiv1.CreateAttachmentRequest{
		Attachment: &apiv1.Attachment{
			Filename: "motion.jpg",
			Type:     "image/jpeg",
			Content:  testutil.BuildMotionPhotoJPEG(),
		},
	})
	require.NoError(t, err)

	_, err = svc.CreateMemo(creatorCtx, &apiv1.CreateMemoRequest{
		Memo: &apiv1.Memo{
			Content:    "motion memo",
			Visibility: apiv1.Visibility_PUBLIC,
			Attachments: []*apiv1.Attachment{
				{Name: attachment.Name},
			},
		},
	})
	require.NoError(t, err)

	e := echo.New()
	fs.RegisterRoutes(e)

	req := httptest.NewRequest(http.MethodGet, fmt.Sprintf("/file/%s/%s?motion=true", attachment.Name, attachment.Filename), nil)
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)

	require.Equal(t, http.StatusOK, rec.Code)
	require.Equal(t, "video/mp4", rec.Header().Get("Content-Type"))
	require.Contains(t, rec.Body.String(), "ftyp")
}

func TestServeAttachmentFile_SVGThumbnailServedAsImageWithSecurityHeaders(t *testing.T) {
	ctx := context.Background()
	svc, fs, _, cleanup := newShareAttachmentTestServices(ctx, t)
	defer cleanup()

	creator, err := svc.Store.CreateUser(ctx, &store.User{
		Username: "svg-owner",
		Role:     store.RoleUser,
		Email:    "svg-owner@example.com",
	})
	require.NoError(t, err)
	creatorCtx := context.WithValue(ctx, auth.UserIDContextKey, creator.ID)

	svgContent := []byte(`<svg xmlns="http://www.w3.org/2000/svg" width="120" height="40"><text x="0" y="20">memos</text></svg>`)
	attachment, err := svc.CreateAttachment(creatorCtx, &apiv1.CreateAttachmentRequest{
		Attachment: &apiv1.Attachment{
			Filename: "preview.svg",
			Type:     "image/svg+xml",
			Content:  svgContent,
		},
	})
	require.NoError(t, err)

	_, err = svc.CreateMemo(creatorCtx, &apiv1.CreateMemoRequest{
		Memo: &apiv1.Memo{
			Content:    "svg memo",
			Visibility: apiv1.Visibility_PUBLIC,
			Attachments: []*apiv1.Attachment{
				{Name: attachment.Name},
			},
		},
	})
	require.NoError(t, err)

	e := echo.New()
	fs.RegisterRoutes(e)

	req := httptest.NewRequest(http.MethodGet, fmt.Sprintf("/file/%s/%s?thumbnail=true", attachment.Name, attachment.Filename), nil)
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)

	require.Equal(t, http.StatusOK, rec.Code)
	require.Equal(t, "image/svg+xml", rec.Header().Get("Content-Type"))
	require.Empty(t, rec.Header().Get("Content-Disposition"))
	require.Equal(t, "nosniff", rec.Header().Get("X-Content-Type-Options"))
	require.Equal(t, "default-src 'none'; style-src 'unsafe-inline';", rec.Header().Get("Content-Security-Policy"))
	require.Equal(t, svgContent, rec.Body.Bytes())
}

func TestServeAttachmentFile_ThumbnailWithSensitiveMetadataServesOriginal(t *testing.T) {
	ctx := context.Background()
	svc, fs, _, cleanup := newShareAttachmentTestServices(ctx, t)
	defer cleanup()

	creator, err := svc.Store.CreateUser(ctx, &store.User{
		Username: "hdr-owner",
		Role:     store.RoleUser,
		Email:    "hdr-owner@example.com",
	})
	require.NoError(t, err)
	creatorCtx := context.WithValue(ctx, auth.UserIDContextKey, creator.ID)

	imageContent := testPNGWithChunk(t, "cICP", []byte{9, 16, 9, 1})
	attachment, err := svc.CreateAttachment(creatorCtx, &apiv1.CreateAttachmentRequest{
		Attachment: &apiv1.Attachment{
			Filename: "hdr.png",
			Type:     "image/png",
			Content:  imageContent,
		},
	})
	require.NoError(t, err)

	_, err = svc.CreateMemo(creatorCtx, &apiv1.CreateMemoRequest{
		Memo: &apiv1.Memo{
			Content:    "hdr memo",
			Visibility: apiv1.Visibility_PUBLIC,
			Attachments: []*apiv1.Attachment{
				{Name: attachment.Name},
			},
		},
	})
	require.NoError(t, err)

	e := echo.New()
	fs.RegisterRoutes(e)

	req := httptest.NewRequest(http.MethodGet, fmt.Sprintf("/file/%s/%s?thumbnail=true", attachment.Name, attachment.Filename), nil)
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)

	require.Equal(t, http.StatusOK, rec.Code)
	require.Equal(t, "image/png", rec.Header().Get("Content-Type"))
	require.Equal(t, imageContent, rec.Body.Bytes())
}

func TestHasThumbnailSensitiveMetadata(t *testing.T) {
	tests := []struct {
		name string
		data []byte
		want bool
	}{
		{
			name: "jpeg hdr gain map",
			data: []byte("xmp hdrgm:Version=\"1.0\""),
			want: true,
		},
		{
			name: "jpeg icc profile",
			data: []byte("ICC_PROFILE"),
			want: true,
		},
		{
			name: "png cicp chunk",
			data: []byte("cICP"),
			want: true,
		},
		{
			name: "plain jpeg",
			data: []byte("plain image data"),
			want: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			require.Equal(t, tt.want, hasThumbnailSensitiveMetadata(tt.data))
		})
	}
}

func testPNGWithChunk(t *testing.T, chunkType string, chunkData []byte) []byte {
	t.Helper()

	img := image.NewRGBA(image.Rect(0, 0, 1, 1))
	img.Set(0, 0, color.RGBA{R: 255, A: 255})

	var encoded bytes.Buffer
	require.NoError(t, png.Encode(&encoded, img))

	pngData := encoded.Bytes()
	iendIndex := bytes.LastIndex(pngData, []byte("IEND"))
	require.GreaterOrEqual(t, iendIndex, 4)

	chunkStart := iendIndex - 4
	var chunk bytes.Buffer
	require.NoError(t, binary.Write(&chunk, binary.BigEndian, uint32(len(chunkData))))
	chunk.WriteString(chunkType)
	chunk.Write(chunkData)
	checksum := crc32.ChecksumIEEE(append([]byte(chunkType), chunkData...))
	require.NoError(t, binary.Write(&chunk, binary.BigEndian, checksum))

	result := make([]byte, 0, len(pngData)+chunk.Len())
	result = append(result, pngData[:chunkStart]...)
	result = append(result, chunk.Bytes()...)
	result = append(result, pngData[chunkStart:]...)
	return result
}

func newShareAttachmentTestServices(ctx context.Context, t *testing.T) (*apiv1service.APIV1Service, *FileServerService, *store.Store, func()) {
	t.Helper()

	testStore := teststore.NewTestingStore(ctx, t)
	setInstanceAccessMode(ctx, t, testStore, storepb.InstanceAccessMode_INSTANCE_ACCESS_MODE_PUBLIC)
	testProfile := &profile.Profile{
		Demo:        true,
		Version:     "test-1.0.0",
		InstanceURL: "http://localhost:8080",
		Driver:      "sqlite",
		DSN:         ":memory:",
		Data:        t.TempDir(),
	}
	secret := "test-secret"
	markdownService := markdown.NewService(markdown.WithTagExtension())
	apiService := &apiv1service.APIV1Service{
		Secret:          secret,
		Profile:         testProfile,
		Store:           testStore,
		MarkdownService: markdownService,
		SSEHub:          apiv1service.NewSSEHub(),
	}
	fileService := NewFileServerService(testProfile, testStore, secret)

	return apiService, fileService, testStore, func() {
		testStore.Close()
	}
}

func setInstanceAccessMode(ctx context.Context, t *testing.T, stores *store.Store, mode storepb.InstanceAccessMode) {
	t.Helper()
	_, err := stores.UpsertInstanceSetting(ctx, &storepb.InstanceSetting{
		Key: storepb.InstanceSettingKey_ACCESS,
		Value: &storepb.InstanceSetting_AccessSetting{AccessSetting: &storepb.InstanceAccessSetting{
			AccessMode: mode,
		}},
	})
	require.NoError(t, err)
}

// makePNGDataURI returns a minimal valid PNG encoded as a data URI, suitable for a
// user avatar.
func makePNGDataURI(t *testing.T) string {
	t.Helper()
	img := image.NewRGBA(image.Rect(0, 0, 1, 1))
	img.Set(0, 0, color.RGBA{R: 1, G: 2, B: 3, A: 255})
	var buf bytes.Buffer
	require.NoError(t, png.Encode(&buf, img))
	return "data:image/png;base64," + base64.StdEncoding.EncodeToString(buf.Bytes())
}

// TestServeAttachmentFile_PrivateInstanceDeniesAnonymous verifies that a public
// memo's attachment is served to anonymous visitors on an open instance but denied
// when the instance access policy is private.
func TestServeAttachmentFile_PrivateInstanceDeniesAnonymous(t *testing.T) {
	ctx := context.Background()
	svc, fs, stores, cleanup := newShareAttachmentTestServices(ctx, t)
	defer cleanup()

	creator, err := svc.Store.CreateUser(ctx, &store.User{
		Username: "private-attachment-owner",
		Role:     store.RoleUser,
		Email:    "private-attachment-owner@example.com",
	})
	require.NoError(t, err)
	creatorCtx := context.WithValue(ctx, auth.UserIDContextKey, creator.ID)

	attachment, err := svc.CreateAttachment(creatorCtx, &apiv1.CreateAttachmentRequest{
		Attachment: &apiv1.Attachment{
			Filename: "public.txt",
			Type:     "text/plain",
			Content:  []byte("public content"),
		},
	})
	require.NoError(t, err)

	_, err = svc.CreateMemo(creatorCtx, &apiv1.CreateMemoRequest{
		Memo: &apiv1.Memo{
			Content:     "public memo",
			Visibility:  apiv1.Visibility_PUBLIC,
			Attachments: []*apiv1.Attachment{{Name: attachment.Name}},
		},
	})
	require.NoError(t, err)

	e := echo.New()
	fs.RegisterRoutes(e)
	url := fmt.Sprintf("/file/%s/%s", attachment.Name, attachment.Filename)

	anonymousGet := func() int {
		rec := httptest.NewRecorder()
		e.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, url, nil))
		return rec.Code
	}

	// Open instance: anonymous access to a public memo's attachment is allowed.
	setInstanceAccessMode(ctx, t, stores, storepb.InstanceAccessMode_INSTANCE_ACCESS_MODE_PUBLIC)
	require.Equal(t, http.StatusOK, anonymousGet())

	// A stale browser session must not prevent access to an otherwise public
	// attachment. Public authorization is independent of invalid credentials.
	req := httptest.NewRequest(http.MethodGet, url, nil)
	req.AddCookie(newExpiredRefreshTokenCookie(ctx, t, stores, creator.ID, svc.Secret))
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)
	require.Equal(t, http.StatusOK, rec.Code)
	require.Equal(t, "public content", rec.Body.String())

	// Private instance: the same anonymous request is denied.
	setInstanceAccessMode(ctx, t, stores, storepb.InstanceAccessMode_INSTANCE_ACCESS_MODE_PRIVATE)
	require.Equal(t, http.StatusUnauthorized, anonymousGet())
}

// TestServeUserAvatar_PrivateInstanceRequiresAuth verifies that avatars are exposed
// to anonymous visitors on an open instance but require authentication on a private
// instance.
func TestServeUserAvatar_PrivateInstanceRequiresAuth(t *testing.T) {
	ctx := context.Background()
	svc, fs, stores, cleanup := newShareAttachmentTestServices(ctx, t)
	defer cleanup()

	owner, err := svc.Store.CreateUser(ctx, &store.User{
		Username:  "avatar-owner",
		Role:      store.RoleUser,
		Email:     "avatar-owner@example.com",
		AvatarURL: makePNGDataURI(t),
	})
	require.NoError(t, err)

	e := echo.New()
	fs.RegisterRoutes(e)

	anonymousGet := func() *httptest.ResponseRecorder {
		rec := httptest.NewRecorder()
		e.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/file/users/avatar-owner/avatar", nil))
		return rec
	}

	// Open instance: anonymous avatar access is allowed.
	setInstanceAccessMode(ctx, t, stores, storepb.InstanceAccessMode_INSTANCE_ACCESS_MODE_PUBLIC)
	publicRec := anonymousGet()
	require.Equal(t, http.StatusOK, publicRec.Code)
	require.Equal(t, cacheMaxAge, publicRec.Header().Get(echo.HeaderCacheControl))

	// A stale browser session must not turn a public avatar request into an
	// authentication error.
	req := httptest.NewRequest(http.MethodGet, "/file/users/avatar-owner/avatar", nil)
	req.AddCookie(newExpiredRefreshTokenCookie(ctx, t, stores, owner.ID, svc.Secret))
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)
	require.Equal(t, http.StatusOK, rec.Code)
	require.Equal(t, "image/png", rec.Header().Get(echo.HeaderContentType))

	// Private instance: anonymous avatar access is denied.
	setInstanceAccessMode(ctx, t, stores, storepb.InstanceAccessMode_INSTANCE_ACCESS_MODE_PRIVATE)
	require.Equal(t, http.StatusUnauthorized, anonymousGet().Code)

	// An authenticated private-instance response must not be stored by shared
	// or browser caches.
	tokenID := util.GenUUID()
	require.NoError(t, stores.AddUserRefreshToken(ctx, owner.ID, &storepb.RefreshTokensUserSetting_RefreshToken{
		TokenId:   tokenID,
		ExpiresAt: timestamppb.New(time.Now().Add(auth.RefreshTokenDuration)),
		CreatedAt: timestamppb.Now(),
	}))
	refreshToken, _, err := auth.GenerateRefreshToken(owner.ID, tokenID, []byte(svc.Secret))
	require.NoError(t, err)
	privateReq := httptest.NewRequest(http.MethodGet, "/file/users/avatar-owner/avatar", nil)
	privateReq.AddCookie(&http.Cookie{Name: auth.RefreshTokenCookieName, Value: refreshToken})
	privateRec := httptest.NewRecorder()
	e.ServeHTTP(privateRec, privateReq)
	require.Equal(t, http.StatusOK, privateRec.Code)
	require.Equal(t, privateAttachmentCacheControl, privateRec.Header().Get(echo.HeaderCacheControl))
}

// TestServeAttachmentFile_RefreshCookieAuthenticatesOwner verifies that the file
// server authenticates a request via the refresh-token cookie (the browser <img>
// flow) — the AuthenticateToUser cookie fallback — letting the owner fetch their own
// private memo's attachment without an Authorization header.
func TestServeAttachmentFile_RefreshCookieAuthenticatesOwner(t *testing.T) {
	ctx := context.Background()
	svc, fs, _, cleanup := newShareAttachmentTestServices(ctx, t)
	defer cleanup()

	owner, err := svc.Store.CreateUser(ctx, &store.User{
		Username: "cookie-owner",
		Role:     store.RoleUser,
		Email:    "cookie-owner@example.com",
	})
	require.NoError(t, err)
	ownerCtx := context.WithValue(ctx, auth.UserIDContextKey, owner.ID)

	attachment, err := svc.CreateAttachment(ownerCtx, &apiv1.CreateAttachmentRequest{
		Attachment: &apiv1.Attachment{
			Filename: "secret.txt",
			Type:     "text/plain",
			Content:  []byte("secret content"),
		},
	})
	require.NoError(t, err)

	_, err = svc.CreateMemo(ownerCtx, &apiv1.CreateMemoRequest{
		Memo: &apiv1.Memo{
			Content:     "private memo",
			Visibility:  apiv1.Visibility_PRIVATE,
			Attachments: []*apiv1.Attachment{{Name: attachment.Name}},
		},
	})
	require.NoError(t, err)

	// Mint a valid refresh token for the owner and store its record.
	tokenID := util.GenUUID()
	require.NoError(t, svc.Store.AddUserRefreshToken(ctx, owner.ID, &storepb.RefreshTokensUserSetting_RefreshToken{
		TokenId:   tokenID,
		ExpiresAt: timestamppb.New(time.Now().Add(auth.RefreshTokenDuration)),
		CreatedAt: timestamppb.Now(),
	}))
	refreshToken, _, err := auth.GenerateRefreshToken(owner.ID, tokenID, []byte(svc.Secret))
	require.NoError(t, err)

	e := echo.New()
	fs.RegisterRoutes(e)
	url := fmt.Sprintf("/file/%s/%s", attachment.Name, attachment.Filename)

	// Without credentials, the private attachment is denied.
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, url, nil))
	require.Equal(t, http.StatusUnauthorized, rec.Code)

	// With the refresh-token cookie, the owner is authenticated and served.
	req := httptest.NewRequest(http.MethodGet, url, nil)
	req.AddCookie(&http.Cookie{Name: auth.RefreshTokenCookieName, Value: refreshToken})
	rec = httptest.NewRecorder()
	e.ServeHTTP(rec, req)
	require.Equal(t, http.StatusOK, rec.Code)
	require.Equal(t, "secret content", rec.Body.String())
}

func newExpiredRefreshTokenCookie(ctx context.Context, t *testing.T, stores *store.Store, userID int32, secret string) *http.Cookie {
	t.Helper()
	tokenID := util.GenUUID()
	require.NoError(t, stores.AddUserRefreshToken(ctx, userID, &storepb.RefreshTokensUserSetting_RefreshToken{
		TokenId:   tokenID,
		ExpiresAt: timestamppb.New(time.Now().Add(-time.Hour)),
		CreatedAt: timestamppb.New(time.Now().Add(-2 * time.Hour)),
	}))
	refreshToken, _, err := auth.GenerateRefreshToken(userID, tokenID, []byte(secret))
	require.NoError(t, err)
	return &http.Cookie{Name: auth.RefreshTokenCookieName, Value: refreshToken}
}
