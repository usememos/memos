// Package version provides a runner to check the latest version of the application.
package version

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"time"

	"github.com/pkg/errors"
	"golang.org/x/exp/slog"

	storepb "github.com/usememos/memos/proto/gen/store"
	"github.com/usememos/memos/server/profile"
	"github.com/usememos/memos/server/version"
	"github.com/usememos/memos/store"
)

type Runner struct {
	Store   *store.Store
	Profile *profile.Profile
}

func NewRunner(store *store.Store, profile *profile.Profile) *Runner {
	return &Runner{
		Store:   store,
		Profile: profile,
	}
}

// Schedule checker every 8 hours.
const runnerInterval = time.Hour * 8

func (r *Runner) Run(ctx context.Context) {
	ticker := time.NewTicker(runnerInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			r.RunOnce(ctx)
		case <-ctx.Done():
			return
		}
	}
}

func (r *Runner) RunOnce(ctx context.Context) {
	r.Check(ctx)
}

func (r *Runner) Check(ctx context.Context) {
	latestVersion, err := r.GetLatestVersion()
	if err != nil {
		return
	}
	if !version.IsVersionGreaterThan(latestVersion, version.GetCurrentVersion(r.Profile.Mode)) {
		return
	}

	versionUpdateActivityType := store.ActivityTypeVersionUpdate
	list, err := r.Store.ListActivities(ctx, &store.FindActivity{
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
	if _, err := r.Store.CreateActivity(ctx, activity); err != nil {
		return
	}

	hostUserRole := store.RoleHost
	users, err := r.Store.ListUsers(ctx, &store.FindUser{
		Role: &hostUserRole,
	})
	if err != nil {
		return
	}
	if len(users) == 0 {
		return
	}

	hostUser := users[0]
	if _, err := r.Store.CreateInbox(ctx, &store.Inbox{
		SenderID:   store.SystemBotID,
		ReceiverID: hostUser.ID,
		Status:     store.UNREAD,
		Message: &storepb.InboxMessage{
			Type:       storepb.InboxMessage_VERSION_UPDATE,
			ActivityId: &activity.ID,
		},
	}); err != nil {
		slog.Error("failed to create inbox", slog.String("error", err.Error()))
	}
}

func (*Runner) GetLatestVersion() (string, error) {
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
