package backup

import (
	"context"
	"fmt"
	"os"
	"strconv"
	"time"

	"go.uber.org/zap"

	apiv1 "github.com/usememos/memos/api/v1"
	"github.com/usememos/memos/internal/log"
	"github.com/usememos/memos/store"
)

// nolint
type BackupRunner struct {
	Store *store.Store
}

func NewBackupRunner(store *store.Store) *BackupRunner {
	return &BackupRunner{
		Store: store,
	}
}

const MaxBackupFiles = 5

func (r *BackupRunner) Run(ctx context.Context) {
	intervalStr := r.Store.GetSystemSettingValueWithDefault(ctx, apiv1.SystemSettingAutoBackupIntervalName.String(), "")
	if intervalStr == "" {
		log.Debug("no SystemSettingAutoBackupIntervalName setting, disable auto backup")
		return
	}

	interval, err := strconv.Atoi(intervalStr)
	if err != nil || interval < 0 {
		log.Error(fmt.Sprintf("invalid SystemSettingAutoBackupIntervalName value %s, disable auto backup", intervalStr), zap.Error(err))
		return
	}

	if interval == 0 {
		println("AutoBackupIntervalName value is 0, disable auto backup")
		return
	}

	log.Info("enable auto backup every " + intervalStr + " seconds")
	ticker := time.NewTicker(time.Duration(interval) * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			log.Info("stop auto backup graceful.")
			return
		case <-ticker.C:
		}

		filename := r.Store.Profile.DSN + ".bak"

		if err := rotateFiles(filename, MaxBackupFiles); err != nil {
			log.Error("fail to rotate backup files", zap.Error(err))
			continue
		}

		log.Info(fmt.Sprintf("create backup to %s", filename))
		if err := r.Store.BackupTo(ctx, filename); err != nil {
			log.Error("fail to create backup", zap.Error(err))
		}
	}
}

func rotateFiles(filename string, cnt int) error {
	// Generate suffix slices of history files like "",".1",".2",".3"...
	ss := make([]string, cnt-1)
	for i := 1; i < len(ss); i++ {
		ss[i] = fmt.Sprintf(".%d", i)
	}

	// Iterate through the suffix slices and rename the files
	for i := len(ss) - 1; i >= 0; i-- {
		from := filename + ss[i]
		to := filename + "." + strconv.Itoa(i+1)

		log.Info("rotate file", zap.String("from", from), zap.String("to", to))
		err := os.Rename(from, to)
		if err != nil && !os.IsNotExist(err) {
			return err
		}
	}

	return nil
}
