package rdsiam

import (
	"crypto/x509"
	"os"

	"github.com/pkg/errors"
)

// LoadCABundle reads a PEM file of CA certificates, such as the RDS
// global-bundle.pem, into a certificate pool.
func LoadCABundle(path string) (*x509.CertPool, error) {
	pem, err := os.ReadFile(path)
	if err != nil {
		return nil, errors.Wrap(err, "failed to read RDS CA bundle")
	}
	pool := x509.NewCertPool()
	if !pool.AppendCertsFromPEM(pem) {
		return nil, errors.Errorf("RDS CA bundle %q contains no PEM certificates", path)
	}
	return pool, nil
}
