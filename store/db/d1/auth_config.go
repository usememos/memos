package d1

import (
	"context"
	"database/sql"

	"github.com/pkg/errors"

	"github.com/usememos/memos/store"
)

// IsRetryableAuthenticationMutationError reports whether err is a transient
// D1 failure (rate limit, overload, or a busy database) worth retrying.
func (*DB) IsRetryableAuthenticationMutationError(err error) bool {
	return isRetryable(err)
}

// ApplyAuthenticationConfigMutation validates the mutation against the
// current authentication state and applies it as one statement. D1 has no
// serializable transaction to hold between the reads and the write; the
// caller retries on transient errors, and the mutation is a single statement
// so it cannot leave partial state.
func (d *DB) ApplyAuthenticationConfigMutation(ctx context.Context, mutation *store.AuthenticationConfigMutation) error {
	state, err := authLoadState(ctx, d.db)
	if err != nil {
		return err
	}
	if mutation.Validate != nil {
		if err := mutation.Validate(state); err != nil {
			return err
		}
	}
	switch {
	case mutation.UpsertGeneralSetting != nil:
		setting := mutation.UpsertGeneralSetting
		_, err = d.execOne(ctx, settingUpsertStatement, setting.Name, setting.Value, setting.Description)
	case mutation.DeleteIdentityProviderID != nil:
		_, err = d.execOne(ctx, "DELETE FROM idp WHERE id = ?", *mutation.DeleteIdentityProviderID)
	default:
		return errors.New("authentication configuration mutation has no operation")
	}
	if err != nil {
		return errors.Wrap(err, "failed to apply authentication configuration mutation")
	}
	return nil
}

// authLoadState reads the GENERAL setting and the identity provider ids.
func authLoadState(ctx context.Context, q querier) (*store.AuthenticationConfigState, error) {
	state := &store.AuthenticationConfigState{}
	general := &store.InstanceSetting{}
	err := q.QueryRowContext(ctx, "SELECT name, value, description FROM system_setting WHERE name = ?", "GENERAL").Scan(
		&general.Name, &general.Value, &general.Description,
	)
	if err == nil {
		state.GeneralSetting = general
	} else if !errors.Is(err, sql.ErrNoRows) {
		return nil, errors.Wrap(err, "failed to read GENERAL setting")
	}

	rows, err := q.QueryContext(ctx, "SELECT id, uid FROM idp ORDER BY id")
	if err != nil {
		return nil, errors.Wrap(err, "failed to read identity providers")
	}
	defer rows.Close()
	for rows.Next() {
		provider := &store.IdentityProvider{}
		if err := rows.Scan(&provider.ID, &provider.UID); err != nil {
			return nil, errors.Wrap(err, "failed to scan identity provider")
		}
		state.IdentityProviders = append(state.IdentityProviders, provider)
	}
	if err := rows.Err(); err != nil {
		return nil, errors.Wrap(err, "failed to iterate identity providers")
	}
	return state, nil
}
