package httpgetter

import (
	"net"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestLinkPreviewRejectsNonPublicAddresses(t *testing.T) {
	for _, address := range []string{
		"100.64.0.1", "100.127.255.254", "::ffff:100.64.0.1",
		"224.0.0.1", "ff02::1", "240.0.0.1", "255.255.255.255",
		"0.1.2.3", "198.18.0.1", "198.19.255.254",
	} {
		t.Run(address, func(t *testing.T) {
			// Given a non-public destination, it must be rejected before HTTP dialing.
			ip := net.ParseIP(address)
			require.NotNil(t, ip)
			require.True(t, isInternalIP(ip))
			_, err := resolveAllowedIPs(t.Context(), address)
			require.ErrorIs(t, err, ErrInternalIP)
		})
	}
}

func TestLinkPreviewAllowsPublicRangeBoundaries(t *testing.T) {
	for _, address := range []string{"100.63.255.254", "100.128.0.1", "198.17.255.254", "198.20.0.1", "8.8.8.8", "2606:4700:4700::1111"} {
		t.Run(address, func(t *testing.T) {
			ip := net.ParseIP(address)
			require.NotNil(t, ip)
			require.False(t, isInternalIP(ip))
		})
	}
}
