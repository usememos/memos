package v1

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"mime"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"time"

	"github.com/pkg/errors"
	"google.golang.org/protobuf/types/known/timestamppb"

	"github.com/usememos/memos/internal/profile"
	"github.com/usememos/memos/internal/util"
	v1pb "github.com/usememos/memos/proto/gen/api/v1"
	storepb "github.com/usememos/memos/proto/gen/store"
	"github.com/usememos/memos/store"
)

func convertAttachmentFromStore(attachment *store.Attachment) *v1pb.Attachment {
	attachmentMessage := &v1pb.Attachment{
		Name:          fmt.Sprintf("%s%s", AttachmentNamePrefix, attachment.UID),
		CreateTime:    timestamppb.New(time.Unix(attachment.CreatedTs, 0)),
		Filename:      attachment.Filename,
		Type:          attachment.Type,
		Size:          attachment.Size,
		MotionMedia:   convertMotionMediaFromStore(getAttachmentMotionMedia(attachment)),
		MediaMetadata: convertMediaMetadataFromStore(attachment.Payload.GetMediaMetadata()),
	}
	if attachment.MemoUID != nil && *attachment.MemoUID != "" {
		memoName := fmt.Sprintf("%s%s", MemoNamePrefix, *attachment.MemoUID)
		attachmentMessage.Memo = &memoName
	}
	// Managed storage is always addressed through the authenticated file route.
	// In particular, never expose an expiring S3 presigned URL as attachment API
	// metadata because it can outlive a memo visibility change.
	if attachment.StorageType == storepb.AttachmentStorageType_EXTERNAL {
		attachmentMessage.ExternalLink = attachment.Reference
	}

	return attachmentMessage
}

// SaveAttachmentBlob saves the blob of attachment based on the storage config.
func SaveAttachmentBlob(ctx context.Context, profile *profile.Profile, stores *store.Store, create *store.Attachment) error {
	instanceStorageSetting, err := stores.GetInstanceStorageSetting(ctx)
	if err != nil {
		return errors.Wrap(err, "Failed to find instance storage setting")
	}
	return saveAttachmentBlobWithInstanceStorageSetting(ctx, profile, stores, create, instanceStorageSetting)
}

func saveAttachmentBlobWithInstanceStorageSetting(
	ctx context.Context,
	profile *profile.Profile,
	stores *store.Store,
	create *store.Attachment,
	instanceStorageSetting *storepb.InstanceStorageSetting,
) error {
	defaultStorage := store.GetDefaultStorage(instanceStorageSetting)
	if defaultStorage == nil {
		return errors.New("default storage is not configured")
	}

	if defaultStorage.Type == storepb.StorageType_STORAGE_TYPE_LOCAL {
		filepathTemplate := "assets/{timestamp}_{uuid}_{filename}"
		if instanceStorageSetting.FilepathTemplate != "" {
			filepathTemplate = instanceStorageSetting.FilepathTemplate
		}

		internalPath := filepathTemplate
		if !strings.Contains(internalPath, "{filename}") {
			internalPath = filepath.Join(internalPath, "{filename}")
		}
		internalPath = replaceFilenameWithPathTemplate(internalPath, create.Filename)
		internalPath = filepath.ToSlash(internalPath)

		// Ensure the directory exists.
		osPath := filepath.FromSlash(internalPath)
		if !filepath.IsAbs(osPath) {
			osPath = filepath.Join(profile.Data, osPath)
		}
		osPath = ensureUniqueLocalAttachmentPath(osPath, create.UID)
		internalPath = filepath.ToSlash(osPath)
		if !filepath.IsAbs(filepath.FromSlash(internalPath)) {
			relativePath, err := filepath.Rel(profile.Data, osPath)
			if err != nil {
				return errors.Wrap(err, "Failed to get relative path")
			}
			internalPath = filepath.ToSlash(relativePath)
		}
		dir := filepath.Dir(osPath)
		if err := os.MkdirAll(dir, os.ModePerm); err != nil {
			return errors.Wrap(err, "Failed to create directory")
		}

		// Write the blob to the file.
		if err := os.WriteFile(osPath, create.Blob, 0644); err != nil {
			return errors.Wrap(err, "Failed to write file")
		}
		create.Reference = internalPath
		create.Blob = nil
		create.StorageType = storepb.AttachmentStorageType_LOCAL
	} else if defaultStorage.Type == storepb.StorageType_STORAGE_TYPE_S3 {
		driver, err := stores.StorageDriver(ctx, defaultStorage)
		if err != nil {
			return errors.Wrap(err, "failed to create storage driver")
		}

		filepathTemplate := instanceStorageSetting.FilepathTemplate
		if !strings.Contains(filepathTemplate, "{filename}") {
			filepathTemplate = filepath.Join(filepathTemplate, "{filename}")
		}
		filepathTemplate = replaceFilenameWithPathTemplate(filepathTemplate, create.Filename)
		key, err := driver.UploadObject(ctx, filepathTemplate, create.Type, bytes.NewReader(create.Blob))
		if err != nil {
			return errors.Wrap(err, "failed to upload via storage driver")
		}

		// S3 attachments carry no reference; they are served via the authenticated file route.
		create.Blob = nil
		create.StorageType = storepb.AttachmentStorageType_S3
		payload := ensureAttachmentPayload(create.Payload)
		payload.Payload = &storepb.AttachmentPayload_S3Object_{
			S3Object: &storepb.AttachmentPayload_S3Object{
				Key:       key,
				StorageId: defaultStorage.Id,
			},
		}
		create.Payload = payload
	}

	return nil
}

func cleanupSavedAttachmentBlob(
	ctx context.Context,
	stores *store.Store,
	attachment *store.Attachment,
	instanceStorageSetting *storepb.InstanceStorageSetting,
) (bool, error) {
	if attachment == nil || (attachment.StorageType != storepb.AttachmentStorageType_LOCAL && attachment.StorageType != storepb.AttachmentStorageType_S3) {
		return false, nil
	}

	cleanupCtx, cancelCleanup := context.WithTimeout(context.WithoutCancel(ctx), 30*time.Second)
	defer cancelCleanup()
	persisted, err := stores.GetAttachment(cleanupCtx, &store.FindAttachment{UID: &attachment.UID})
	if err != nil {
		return false, errors.Wrap(err, "failed to verify attachment create outcome")
	}
	if hasSameManagedStorageObject(persisted, attachment) {
		return true, nil
	}
	return false, stores.DeleteAttachmentStorageWithInstanceSetting(cleanupCtx, attachment, instanceStorageSetting)
}

func hasSameManagedStorageObject(left, right *store.Attachment) bool {
	if left == nil || right == nil || left.StorageType != right.StorageType {
		return false
	}
	switch left.StorageType {
	case storepb.AttachmentStorageType_LOCAL:
		return left.Reference != "" && left.Reference == right.Reference
	case storepb.AttachmentStorageType_S3:
		leftObject, rightObject := left.Payload.GetS3Object(), right.Payload.GetS3Object()
		return leftObject != nil && rightObject != nil && leftObject.Key != "" && leftObject.Key == rightObject.Key && leftObject.StorageId == rightObject.StorageId
	default:
		return false
	}
}

func (s *APIV1Service) cleanupDeletedAttachmentStorage(ctx context.Context, attachments []*store.Attachment) error {
	var instanceStorageSetting *storepb.InstanceStorageSetting
	var instanceStorageSettingErr error
	for _, attachment := range attachments {
		if store.AttachmentNeedsInstanceStorageSetting(attachment) {
			instanceStorageSetting, instanceStorageSettingErr = s.Store.GetInstanceStorageSetting(ctx)
			break
		}
	}

	var firstErr error
	for _, attachment := range attachments {
		if attachment == nil {
			continue
		}
		var err error
		if instanceStorageSettingErr != nil && store.AttachmentNeedsInstanceStorageSetting(attachment) {
			err = errors.Wrap(instanceStorageSettingErr, "failed to get instance storage setting")
		} else {
			err = s.Store.DeleteAttachmentStorageWithInstanceSetting(ctx, attachment, instanceStorageSetting)
		}
		if err != nil && firstErr == nil {
			firstErr = errors.Wrapf(err, "attachment %d", attachment.ID)
		}
	}
	return firstErr
}

// GetAttachmentBlob reads an attachment from its configured storage.
func (s *APIV1Service) GetAttachmentBlob(ctx context.Context, attachment *store.Attachment) ([]byte, error) {
	// For local storage, read the file from the local disk.
	if attachment.StorageType == storepb.AttachmentStorageType_LOCAL {
		attachmentPath := filepath.FromSlash(attachment.Reference)
		if !filepath.IsAbs(attachmentPath) {
			attachmentPath = filepath.Join(s.Profile.Data, attachmentPath)
		}

		file, err := os.Open(attachmentPath)
		if err != nil {
			if os.IsNotExist(err) {
				return nil, errors.Wrap(err, "file not found")
			}
			return nil, errors.Wrap(err, "failed to open the file")
		}
		defer file.Close()
		blob, err := io.ReadAll(file)
		if err != nil {
			return nil, errors.Wrap(err, "failed to read the file")
		}
		return blob, nil
	}
	// For S3 storage, download the file from S3.
	if attachment.StorageType == storepb.AttachmentStorageType_S3 {
		driver, s3Object, err := s.Store.ResolveAttachmentS3Driver(ctx, attachment)
		if err != nil {
			return nil, errors.Wrap(err, "failed to resolve S3 attachment driver")
		}

		blob, err := driver.GetObject(ctx, s3Object.Key)
		if err != nil {
			return nil, errors.Wrap(err, "failed to get object from S3")
		}
		return blob, nil
	}
	// For database storage, return the blob from the database.
	return attachment.Blob, nil
}

var fileKeyPattern = regexp.MustCompile(`\{[a-z]{1,9}\}`)

func replaceFilenameWithPathTemplate(path, filename string) string {
	t := time.Now()
	path = fileKeyPattern.ReplaceAllStringFunc(path, func(s string) string {
		switch s {
		case "{filename}":
			return filename
		case "{timestamp}":
			return fmt.Sprintf("%d", t.Unix())
		case "{year}":
			return fmt.Sprintf("%d", t.Year())
		case "{month}":
			return fmt.Sprintf("%02d", t.Month())
		case "{day}":
			return fmt.Sprintf("%02d", t.Day())
		case "{hour}":
			return fmt.Sprintf("%02d", t.Hour())
		case "{minute}":
			return fmt.Sprintf("%02d", t.Minute())
		case "{second}":
			return fmt.Sprintf("%02d", t.Second())
		case "{uuid}":
			return util.GenUUID()
		default:
			return s
		}
	})
	return path
}

func ensureUniqueLocalAttachmentPath(path, uid string) string {
	if _, err := os.Stat(path); err != nil {
		return path
	}

	ext := filepath.Ext(path)
	base := strings.TrimSuffix(path, ext)
	return base + "_" + uid + ext
}

func validateFilename(filename string) bool {
	// Reject path traversal attempts and make sure no additional directories are created
	if !filepath.IsLocal(filename) || strings.ContainsAny(filename, "/\\") {
		return false
	}

	// Reject filenames starting or ending with spaces or periods
	if strings.HasPrefix(filename, " ") || strings.HasSuffix(filename, " ") ||
		strings.HasPrefix(filename, ".") || strings.HasSuffix(filename, ".") {
		return false
	}

	return true
}

func normalizeMimeType(mimeType string) (string, bool) {
	mimeType = strings.TrimSpace(mimeType)
	if mimeType == "" || len(mimeType) > 255 {
		return "", false
	}

	mediaType, _, err := mime.ParseMediaType(mimeType)
	if err != nil || mediaType == "" || len(mediaType) > 255 {
		return "", false
	}

	return mediaType, true
}
