package mysql

import (
	"context"
	"testing"

	mysqldriver "github.com/go-sql-driver/mysql"
	"github.com/pkg/errors"
	"github.com/stretchr/testify/require"

	"github.com/usememos/memos/internal/rdsiam"
	"github.com/usememos/memos/internal/testutil"
)

type fakeTokenSource struct {
	host string
	port int
	user string
	err  error
}

func (f *fakeTokenSource) Token(_ context.Context, host string, port int, user string) (string, error) {
	f.host, f.port, f.user = host, port, user
	return "", f.err
}

func TestRDSIAMConfigRejectsInsecureDSN(t *testing.T) {
	for name, dsn := range map[string]string{
		"no TLS":        "memos@tcp(db.example.com:3306)/memos",
		"TLS disabled":  "memos@tcp(db.example.com:3306)/memos?tls=false",
		"TLS preferred": "memos@tcp(db.example.com:3306)/memos?tls=preferred",
		"unix socket":   "memos@unix(/tmp/mysql.sock)/memos?tls=true",
		"no user":       "tcp(db.example.com:3306)/memos?tls=true",
	} {
		t.Run(name, func(t *testing.T) {
			config, err := mysqldriver.ParseDSN(dsn)
			require.NoError(t, err)
			_, err = rdsIAMConfig(config, nil, &fakeTokenSource{})
			require.Error(t, err)
		})
	}
}

func TestRDSIAMConfigCABundleEnablesVerifiedTLS(t *testing.T) {
	caBundle, err := rdsiam.LoadCABundle(testutil.WriteCACertificate(t))
	require.NoError(t, err)

	for _, dsn := range []string{
		"memos@tcp(db.example.com:3306)/memos",
		"memos@tcp(db.example.com:3306)/memos?tls=skip-verify",
		"memos@tcp(db.example.com:3306)/memos?tls=preferred",
	} {
		config, err := mysqldriver.ParseDSN(dsn)
		require.NoError(t, err)
		got, err := rdsIAMConfig(config, caBundle, &fakeTokenSource{})
		require.NoError(t, err, dsn)
		require.NotNil(t, got.TLS, dsn)
		require.False(t, got.TLS.InsecureSkipVerify, dsn)
		require.Same(t, caBundle, got.TLS.RootCAs, dsn)
		require.Equal(t, "db.example.com", got.TLS.ServerName, dsn)
		require.False(t, got.AllowFallbackToPlaintext, dsn)
	}
}

func TestRDSIAMConfigSignsTokenPerConnection(t *testing.T) {
	config, err := mysqldriver.ParseDSN("memos@tcp(db.example.com:3307)/memos?tls=skip-verify")
	require.NoError(t, err)
	tokens := &fakeTokenSource{err: errors.New("no credentials")}

	got, err := rdsIAMConfig(config, nil, tokens)
	require.NoError(t, err)
	require.True(t, got.AllowCleartextPasswords)
	require.False(t, config.AllowCleartextPasswords, "the caller's config must not be mutated")
	connector, err := mysqldriver.NewConnector(got)
	require.NoError(t, err)

	_, err = connector.Connect(context.Background())
	require.ErrorContains(t, err, "no credentials")
	require.Equal(t, "db.example.com", tokens.host)
	require.Equal(t, 3307, tokens.port)
	require.Equal(t, "memos", tokens.user)
}
