package postgres

import (
	"context"
	"database/sql/driver"
	"log/slog"

	"github.com/lib/pq"
	"github.com/pkg/errors"

	"github.com/usememos/memos/internal/rdsiam"
)

type tokenSource interface {
	Token(ctx context.Context, host string, port int, user string) (string, error)
}

// rdsIAMConnector opens each connection with a freshly signed RDS IAM token as
// the password, because a token expires 15 minutes after it is signed.
type rdsIAMConnector struct {
	cfg    pq.Config
	tokens tokenSource
}

func newRDSIAMConnector(ctx context.Context, dsn, caBundlePath string) (*rdsIAMConnector, error) {
	cfg, err := rdsIAMConfig(dsn, caBundlePath)
	if err != nil {
		return nil, err
	}
	tokens, err := rdsiam.NewTokenSource(ctx)
	if err != nil {
		return nil, err
	}
	return &rdsIAMConnector{cfg: cfg, tokens: tokens}, nil
}

// rdsIAMConfig parses dsn and rejects settings RDS IAM authentication cannot
// work with: a token is signed for one TCP endpoint and is only accepted over SSL.
// caBundlePath, when set, becomes sslrootcert and raises sslmode require to
// verify-full.
func rdsIAMConfig(dsn, caBundlePath string) (pq.Config, error) {
	cfg, err := pq.NewConfig(dsn)
	if err != nil {
		return pq.Config{}, errors.Wrap(err, "failed to parse DSN")
	}
	if caBundlePath != "" {
		// Fail at startup rather than on the first connection.
		if _, err := rdsiam.LoadCABundle(caBundlePath); err != nil {
			return pq.Config{}, err
		}
		cfg.SSLRootCert, cfg.SSLInline = caBundlePath, false
		if cfg.SSLMode == "" || cfg.SSLMode == pq.SSLModeRequire {
			cfg.SSLMode = pq.SSLModeVerifyFull
		}
	}
	if len(cfg.Multi) > 0 {
		return pq.Config{}, errors.New("RDS IAM authentication requires a single host in the DSN")
	}
	// The token is signed for Host, so it must name the endpoint even when
	// hostaddr picks the address to dial.
	if cfg.Hostaddr.IsValid() && (cfg.Host == "" || cfg.Host == "localhost") {
		return pq.Config{}, errors.New("RDS IAM authentication requires the RDS endpoint name in host when hostaddr is set")
	}
	switch cfg.SSLMode {
	case pq.SSLModeDisable, pq.SSLModeAllow, pq.SSLModePrefer:
		return pq.Config{}, errors.Errorf("RDS IAM authentication requires SSL, got sslmode=%s", cfg.SSLMode)
	case "", pq.SSLModeRequire:
		// pq verifies the CA under sslmode=require only when sslrootcert is set.
		if cfg.SSLRootCert == "" {
			slog.Warn("RDS IAM authentication without server certificate verification exposes the token to a man-in-the-middle; set --rds-ca-bundle")
		}
	default:
	}
	// A password file would override the token.
	cfg.Passfile = ""
	return cfg, nil
}

func (c *rdsIAMConnector) Connect(ctx context.Context) (driver.Conn, error) {
	token, err := c.tokens.Token(ctx, c.cfg.Host, int(c.cfg.Port), c.cfg.User)
	if err != nil {
		return nil, err
	}
	cfg := c.cfg.Clone()
	cfg.Password = token
	connector, err := pq.NewConnectorConfig(cfg)
	if err != nil {
		return nil, err
	}
	return connector.Connect(ctx)
}

func (*rdsIAMConnector) Driver() driver.Driver {
	return &pq.Driver{}
}
