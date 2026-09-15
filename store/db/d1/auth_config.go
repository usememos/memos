package d1

import (
	"context"
	"database/sql"

	"github.com/pkg/errors"

	"github.com/usememos/memos/store"
)

// errAuthStateChanged reports that the authentication state changed between
// validation and the write; the store retries the mutation.
var errAuthStateChanged = errors.New("d1: authentication configuration changed during mutation")

// IsRetryableAuthenticationMutationError reports whether err is a transient
// D1 failure (rate limit, overload, or a busy database) or a mutation that
// lost the race against a concurrent authentication change; both are worth
// retrying.
func (*DB) IsRetryableAuthenticationMutationError(err error) bool {
	return errors.Is(err, errAuthStateChanged) || isRetryable(err)
}

// ApplyAuthenticationConfigMutation validates the mutation against the
// current authentication state and applies it. D1 has no serializable
// transaction to hold between the reads and the write, so the batch guards
// that the GENERAL setting and the identity provider set are exactly what was
// validated; a concurrent change aborts the write and the store retries.
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
	b := newBatch()
	authGuardState(b, state)
	switch {
	case mutation.UpsertGeneralSetting != nil:
		setting := mutation.UpsertGeneralSetting
		b.add(settingUpsertStatement, setting.Name, setting.Value, setting.Description)
	case mutation.DeleteIdentityProviderID != nil:
		b.add("DELETE FROM idp WHERE id = ?", *mutation.DeleteIdentityProviderID)
	default:
		return errors.New("authentication configuration mutation has no operation")
	}
	if _, err := b.commit(ctx, d); err != nil {
		return errors.Wrap(guardError(err, errAuthStateChanged), "failed to apply authentication configuration mutation")
	}
	return nil
}

// authGuardState asserts that the GENERAL setting and the identity provider
// ids are unchanged since state was read.
func authGuardState(b *batch, state *store.AuthenticationConfigState) {
	generalCount, generalValue := 0, ""
	if state.GeneralSetting != nil {
		generalCount, generalValue = 1, state.GeneralSetting.Value
	}
	b.guard("(SELECT COUNT(*) FROM system_setting WHERE name = 'GENERAL') = ?", generalCount)
	b.guard("COALESCE((SELECT value FROM system_setting WHERE name = 'GENERAL'), '') = ?", generalValue)

	ids := make([]int32, 0, len(state.IdentityProviders))
	for _, provider := range state.IdentityProviders {
		ids = append(ids, provider.ID)
	}
	b.guard("(SELECT COUNT(*) FROM idp) = ?", len(ids))
	if len(ids) > 0 {
		b.guard("NOT EXISTS (SELECT 1 FROM idp WHERE id NOT IN " + intList(ids) + ")")
	}
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
