package mysql

import (
	"context"
	"crypto/tls"
	"crypto/x509"
	"database/sql/driver"
	"log/slog"
	"net"
	"strconv"

	"github.com/go-sql-driver/mysql"
	"github.com/pkg/errors"

	"github.com/usememos/memos/internal/rdsiam"
)

type tokenSource interface {
	Token(ctx context.Context, host string, port int, user string) (string, error)
}

// newRDSIAMConnector opens each connection with a freshly signed RDS IAM token
// as the password, because a token expires 15 minutes after it is signed.
// caBundlePath, when set, replaces the DSN's tls setting with TLS verified
// against that CA bundle.
func newRDSIAMConnector(ctx context.Context, config *mysql.Config, caBundlePath string) (driver.Connector, error) {
	var caBundle *x509.CertPool
	if caBundlePath != "" {
		var err error
		if caBundle, err = rdsiam.LoadCABundle(caBundlePath); err != nil {
			return nil, err
		}
	}
	tokens, err := rdsiam.NewTokenSource(ctx)
	if err != nil {
		return nil, err
	}
	config, err = rdsIAMConfig(config, caBundle, tokens)
	if err != nil {
		return nil, err
	}
	return mysql.NewConnector(config)
}

// rdsIAMConfig returns a copy of config that signs a token before each
// connection. It rejects settings RDS IAM authentication cannot work with: a
// token is signed for one TCP endpoint and is only accepted over TLS.
func rdsIAMConfig(config *mysql.Config, caBundle *x509.CertPool, tokens tokenSource) (*mysql.Config, error) {
	if config.Net != "tcp" {
		return nil, errors.Errorf("RDS IAM authentication requires a TCP connection, got %q", config.Net)
	}
	if config.User == "" {
		return nil, errors.New("RDS IAM authentication requires a database user in the DSN")
	}
	host, rawPort, err := net.SplitHostPort(config.Addr)
	if err != nil {
		return nil, errors.Wrapf(err, "failed to parse database address %q", config.Addr)
	}
	port, err := strconv.Atoi(rawPort)
	if err != nil {
		return nil, errors.Wrapf(err, "failed to parse database port %q", rawPort)
	}

	config = config.Clone()
	if caBundle != nil {
		config.TLS = &tls.Config{RootCAs: caBundle, ServerName: host, MinVersion: tls.VersionTLS12}
		config.AllowFallbackToPlaintext = false
	}
	if config.TLS == nil || config.AllowFallbackToPlaintext {
		return nil, errors.New("RDS IAM authentication requires TLS; set --rds-ca-bundle or tls=true in the DSN")
	}
	if config.TLS.InsecureSkipVerify {
		slog.Warn("RDS IAM authentication without server certificate verification exposes the token to a man-in-the-middle; set --rds-ca-bundle")
	}
	// RDS receives the token through the mysql_clear_password plugin.
	config.AllowCleartextPasswords = true
	if err := config.Apply(mysql.BeforeConnect(func(ctx context.Context, cfg *mysql.Config) error {
		token, err := tokens.Token(ctx, host, port, cfg.User)
		if err != nil {
			return err
		}
		cfg.Passwd = token
		return nil
	})); err != nil {
		return nil, errors.Wrap(err, "failed to configure RDS IAM authentication")
	}
	return config, nil
}
