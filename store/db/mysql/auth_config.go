package mysql

import (
	"context"
	"database/sql"

	mysqldriver "github.com/go-sql-driver/mysql"
	"github.com/pkg/errors"

	"github.com/usememos/memos/store"
)

// IsRetryableAuthenticationMutationError reports whether err is a transient MySQL transaction failure.
func (*DB) IsRetryableAuthenticationMutationError(err error) bool {
	var mysqlErr *mysqldriver.MySQLError
	if !errors.As(err, &mysqlErr) {
		return false
	}
	return mysqlErr.Number == 1205 || mysqlErr.Number == 1213
}

// ApplyAuthenticationConfigMutation validates and applies an auth mutation in a serializable transaction.
func (d *DB) ApplyAuthenticationConfigMutation(ctx context.Context, mutation *store.AuthenticationConfigMutation) error {
	tx, err := d.db.BeginTx(ctx, &sql.TxOptions{Isolation: sql.LevelSerializable})
	if err != nil {
		return errors.Wrap(err, "failed to begin authentication configuration transaction")
	}
	defer func() {
		_ = tx.Rollback()
	}()

	state := &store.AuthenticationConfigState{}
	general := &store.InstanceSetting{}
	err = tx.QueryRowContext(ctx, "SELECT `name`, `value`, `description` FROM `system_setting` WHERE `name` = ? FOR UPDATE", "GENERAL").Scan(
		&general.Name, &general.Value, &general.Description,
	)
	if err == nil {
		state.GeneralSetting = general
	} else if !errors.Is(err, sql.ErrNoRows) {
		return errors.Wrap(err, "failed to read GENERAL setting")
	}
	rows, err := tx.QueryContext(ctx, "SELECT `id`, `uid` FROM `idp` ORDER BY `id` FOR UPDATE")
	if err != nil {
		return errors.Wrap(err, "failed to read identity providers")
	}
	defer rows.Close()
	for rows.Next() {
		provider := &store.IdentityProvider{}
		if err := rows.Scan(&provider.ID, &provider.UID); err != nil {
			rows.Close()
			return errors.Wrap(err, "failed to scan identity provider")
		}
		state.IdentityProviders = append(state.IdentityProviders, provider)
	}
	if err := rows.Err(); err != nil {
		rows.Close()
		return errors.Wrap(err, "failed to iterate identity providers")
	}
	if err := rows.Close(); err != nil {
		return errors.Wrap(err, "failed to close identity provider rows")
	}
	if mutation.Validate != nil {
		if err := mutation.Validate(state); err != nil {
			return err
		}
	}
	if setting := mutation.UpsertGeneralSetting; setting != nil {
		_, err = tx.ExecContext(ctx, "INSERT INTO `system_setting` (`name`, `value`, `description`) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE `value` = ?, `description` = ?", setting.Name, setting.Value, setting.Description, setting.Value, setting.Description)
	} else if id := mutation.DeleteIdentityProviderID; id != nil {
		_, err = tx.ExecContext(ctx, "DELETE FROM `idp` WHERE `id` = ?", *id)
	} else {
		return errors.New("authentication configuration mutation has no operation")
	}
	if err != nil {
		return errors.Wrap(err, "failed to apply authentication configuration mutation")
	}
	if err := tx.Commit(); err != nil {
		return errors.Wrap(err, "failed to commit authentication configuration transaction")
	}
	return nil
}
