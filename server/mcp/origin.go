package mcp

import (
	"net/url"
	"strings"

	"github.com/usememos/memos/internal/profile"
)

func isAllowedMCPOrigin(host string, origin string, profile *profile.Profile) bool {
	if origin == "" {
		return true
	}

	originURL, err := url.Parse(origin)
	if err != nil || originURL.Scheme == "" || originURL.Host == "" {
		return false
	}
	if strings.EqualFold(originURL.Host, host) {
		return true
	}

	if profile == nil || profile.InstanceURL == "" {
		return false
	}
	instanceURL, err := url.Parse(profile.InstanceURL)
	if err != nil || instanceURL.Scheme == "" || instanceURL.Host == "" {
		return false
	}
	return strings.EqualFold(originURL.Scheme, instanceURL.Scheme) && strings.EqualFold(originURL.Host, instanceURL.Host)
}
