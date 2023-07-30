package server

import (
	"context"
	"fmt"
	"strconv"
	"time"

	apiv1 "github.com/usememos/memos/api/v1"
	"github.com/usememos/memos/common/log"
	"github.com/usememos/memos/store"
	"go.uber.org/zap"
)

type BackupRunner struct {
	Store *store.Store
}

func NewBackupRunner(store *store.Store) *BackupRunner {
	return &BackupRunner{
		Store: store,
	}
}

func (r *BackupRunner) Run(ctx context.Context) {
	intervalStr := r.Store.GetSystemSettingValueWithDefault(&ctx, apiv1.SystemSettingAutoBackupIntervalName.String(), "")
	if intervalStr == "" {
		log.Info("no SystemSettingAutoBackupIntervalName setting, disable auto backup")
		return
	}

	interval, err := strconv.Atoi(intervalStr)
	if err != nil || interval <= 0 {
		log.Error(fmt.Sprintf("invalid SystemSettingAutoBackupIntervalName value %s, disable auto backup", intervalStr), zap.Error(err))
		return
	}

	log.Info("enable auto backup every " + intervalStr + " seconds")
	ticker := time.NewTicker(time.Duration(interval) * time.Second)
	defer ticker.Stop()

	var t time.Time
	for {
		select {
		case <-ctx.Done():
			log.Info("stop auto backup graceful.")
			return
		case t = <-ticker.C:
		}

		filename := r.Store.Profile.DSN + t.Format("-20060102-150405.bak")
		log.Info(fmt.Sprintf("create backup to %s", filename))
		err := r.Store.BackupTo(ctx, filename)
		if err != nil {
			log.Error("fail to create backup", zap.Error(err))
		}
	}
}
