package versionchecker

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/pkg/errors"

	storepb "github.com/usememos/memos/proto/gen/store"
	"github.com/usememos/memos/server/profile"
	"github.com/usememos/memos/server/version"
	"github.com/usememos/memos/store"
)

// nolint
type VersionChecker struct {
	Store   *store.Store
	Profile *profile.Profile
}

func NewVersionChecker(store *store.Store, profile *profile.Profile) *VersionChecker {
	return &VersionChecker{
		Store:   store,
		Profile: profile,
	}
}

func (*VersionChecker) GetLatestVersion() (string, error) {
	response, err := http.Get("https://www.usememos.com/api/version")
	if err != nil {
		return "", errors.Wrap(err, "failed to make http request")
	}
	defer response.Body.Close()

	buf := &bytes.Buffer{}
	_, err = buf.ReadFrom(response.Body)
	if err != nil {
		return "", errors.Wrap(err, "fail to read response body")
	}

	version := ""
	if err = json.Unmarshal(buf.Bytes(), &version); err != nil {
		return "", errors.Wrap(err, "fail to unmarshal get version response")
	}
	return version, nil
}

func (c *VersionChecker) Check(ctx context.Context) {
	latestVersion, err := c.GetLatestVersion()
	if err != nil {
		return
	}
	if !version.IsVersionGreaterThan(latestVersion, version.GetCurrentVersion(c.Profile.Mode)) {
		return
	}

	versionUpdateActivityType := store.ActivityTypeVersionUpdate
	list, err := c.Store.ListActivities(ctx, &store.FindActivity{
		Type: &versionUpdateActivityType,
	})
	if err != nil {
		return
	}

	shouldNotify := true
	if len(list) > 0 {
		latestVersionUpdateActivity := list[0]
		if latestVersionUpdateActivity.Payload != nil && version.IsVersionGreaterOrEqualThan(latestVersionUpdateActivity.Payload.VersionUpdate.Version, latestVersion) {
			shouldNotify = false
		}
	}

	if !shouldNotify {
		return
	}

	// Create version update activity and inbox message.
	activity := &store.Activity{
		CreatorID: store.SystemBotID,
		Type:      store.ActivityTypeVersionUpdate,
		Level:     store.ActivityLevelInfo,
		Payload: &storepb.ActivityPayload{
			VersionUpdate: &storepb.ActivityVersionUpdatePayload{
				Version: latestVersion,
			},
		},
	}
	if _, err := c.Store.CreateActivity(ctx, activity); err != nil {
		return
	}

	hostUserRole := store.RoleHost
	users, err := c.Store.ListUsers(ctx, &store.FindUser{
		Role: &hostUserRole,
	})
	if err != nil {
		return
	}
	if len(users) == 0 {
		return
	}

	hostUser := users[0]
	if _, err := c.Store.CreateInbox(ctx, &store.Inbox{
		SenderID:   store.SystemBotID,
		ReceiverID: hostUser.ID,
		Status:     store.UNREAD,
		Message: &storepb.InboxMessage{
			Type:       storepb.InboxMessage_VERSION_UPDATE,
			ActivityId: &activity.ID,
		},
	}); err != nil {
		fmt.Printf("failed to create inbox: %s\n", err)
	}
}

func (c *VersionChecker) Start(ctx context.Context) {
	c.Check(ctx)

	// Schedule checker every 8 hours.
	ticker := time.NewTicker(8 * time.Hour)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
		}

		c.Check(ctx)
	}
}
