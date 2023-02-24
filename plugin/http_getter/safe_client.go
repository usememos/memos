package getter

import (
	"fmt"
	"net"
	"net/http"
	"syscall"
)

var client = &http.Client{
	Transport: &http.Transport{
		DialContext: (&net.Dialer{
			Control: safeSocketControl,
		}).DialContext,
	},
}

func safeSocketControl(_ string, address string, _ syscall.RawConn) error {
	host, _, err := net.SplitHostPort(address)
	if err != nil {
		return fmt.Errorf("%s is not a valid host/port pair: %s", address, err)
	}

	ipAddress := net.ParseIP(host)
	if ipAddress == nil {
		return fmt.Errorf("%s is not a valid IP address", host)
	}

	if ipAddress.IsLoopback() || ipAddress.IsLinkLocalUnicast() || ipAddress.IsLinkLocalMulticast() || ipAddress.IsPrivate() {
		return fmt.Errorf("%s is not allowed", host)
	}

	return nil
}
