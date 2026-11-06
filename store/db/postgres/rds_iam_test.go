package postgres

import (
	"context"
	"path/filepath"
	"testing"

	"github.com/lib/pq"
	"github.com/pkg/errors"
	"github.com/stretchr/testify/require"

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
		"SSL disabled":  "postgres://memos@db.example.com:5432/memos?sslmode=disable",
		"SSL preferred": "postgres://memos@db.example.com:5432/memos?sslmode=prefer",
		"multiple host": "host=db1.example.com,db2.example.com user=memos dbname=memos",
		"unix socket":   "host=/var/run/postgresql user=memos dbname=memos",
		"hostaddr only": "hostaddr=10.0.0.12 user=memos dbname=memos",
	} {
		t.Run(name, func(t *testing.T) {
			_, err := rdsIAMConfig(dsn, "")
			require.Error(t, err)
		})
	}
}

func TestRDSIAMConfigCABundle(t *testing.T) {
	caBundle := testutil.WriteCACertificate(t)
	for dsn, want := range map[string]pq.SSLMode{
		"postgres://memos@db.example.com:5432/memos":                   pq.SSLModeVerifyFull,
		"postgres://memos@db.example.com:5432/memos?sslmode=require":   pq.SSLModeVerifyFull,
		"postgres://memos@db.example.com:5432/memos?sslmode=verify-ca": pq.SSLModeVerifyCA,
		"postgres://memos@db.example.com:5432/memos?sslrootcert=other": pq.SSLModeVerifyFull,
	} {
		cfg, err := rdsIAMConfig(dsn, caBundle)
		require.NoError(t, err, dsn)
		require.Equal(t, want, cfg.SSLMode, dsn)
		require.Equal(t, caBundle, cfg.SSLRootCert, dsn)
	}

	_, err := rdsIAMConfig("postgres://memos@db.example.com:5432/memos", filepath.Join(t.TempDir(), "missing.pem"))
	require.Error(t, err)
	_, err = rdsIAMConfig("postgres://memos@db.example.com:5432/memos?sslmode=disable", caBundle)
	require.Error(t, err)
}

func TestRDSIAMConnectorSignsTokenPerConnection(t *testing.T) {
	cfg, err := rdsIAMConfig("postgres://memos@db.example.com:6543/memos?sslmode=verify-full", "")
	require.NoError(t, err)
	tokens := &fakeTokenSource{err: errors.New("no credentials")}
	connector := &rdsIAMConnector{cfg: cfg, tokens: tokens}

	_, err = connector.Connect(context.Background())
	require.ErrorContains(t, err, "no credentials")
	require.Equal(t, "db.example.com", tokens.host)
	require.Equal(t, 6543, tokens.port)
	require.Equal(t, "memos", tokens.user)
}
