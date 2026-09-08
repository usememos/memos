package email

import (
	"net"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestConfigServerAddressPreservesHost(t *testing.T) {
	for _, host := range []string{"smtp.example.com", "127.0.0.1", "::1", "2001:db8::1", "fe80::1%eth0"} {
		t.Run(host, func(t *testing.T) {
			config := Config{SMTPHost: host, SMTPPort: 587}

			address := config.GetServerAddress()
			gotHost, gotPort, err := net.SplitHostPort(address)
			require.NoError(t, err, "SMTP address: %s", address)
			require.Equal(t, host, gotHost)
			require.Equal(t, "587", gotPort)
		})
	}
}
