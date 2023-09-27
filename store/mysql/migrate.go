package mysql

import (
	"context"
	"embed"
	"fmt"
	"strings"

	"github.com/pkg/errors"

	"github.com/usememos/memos/common/log"
)

const (
	latestSchemaFileName = "LATEST__SCHEMA.sql"
)

//go:embed migration
var migrationFS embed.FS

func (d *Driver) Migrate(ctx context.Context) error {
	if !d.profile.IsDev() {
		log.Error("driver.Migrate MUST BE implement for prod mode")
		return errNotImplemented
	}

	// Always load the latest schema in non-prod mode
	if d.profile.IsDev() {
		latestSchemaPath := fmt.Sprintf("%s/%s/%s", "migration", d.profile.Mode, latestSchemaFileName)
		buf, err := migrationFS.ReadFile(latestSchemaPath)
		if err != nil {
			return errors.Errorf("failed to read latest schema file: %s", err)
		}

		for _, stmt := range strings.Split(string(buf), ";") {
			stmt = strings.TrimSpace(stmt)
			if stmt == "" {
				continue
			}
			_, err := d.db.ExecContext(ctx, stmt)
			if err != nil {
				return errors.Errorf("failed to exec SQL %s: %s", stmt, err)
			}
		}
		return nil
	}

	return nil
}
