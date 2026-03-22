package v1

import (
	"context"
	"testing"

	"google.golang.org/grpc/metadata"

	storepb "github.com/usememos/memos/proto/gen/store"
)

func TestParseUserAgent(t *testing.T) {
	service := &APIV1Service{}

	tests := []struct {
		name            string
		userAgent       string
		expectedDevice  string
		expectedOS      string
		expectedBrowser string
	}{
		{
			name:            "Chrome on Windows",
			userAgent:       "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
			expectedDevice:  "desktop",
			expectedOS:      "Windows 10/11",
			expectedBrowser: "Chrome 119.0.0.0",
		},
		{
			name:            "Safari on macOS",
			userAgent:       "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
			expectedDevice:  "desktop",
			expectedOS:      "macOS 10.15.7",
			expectedBrowser: "Safari 17.0",
		},
		{
			name:            "Chrome on Android Mobile",
			userAgent:       "Mozilla/5.0 (Linux; Android 13; SM-G998B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Mobile Safari/537.36",
			expectedDevice:  "mobile",
			expectedOS:      "Android 13",
			expectedBrowser: "Chrome 119.0.0.0",
		},
		{
			name:            "Safari on iPhone",
			userAgent:       "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
			expectedDevice:  "mobile",
			expectedOS:      "iOS 17.0",
			expectedBrowser: "Safari 17.0",
		},
		{
			name:            "Firefox on Windows",
			userAgent:       "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/119.0",
			expectedDevice:  "desktop",
			expectedOS:      "Windows 10/11",
			expectedBrowser: "Firefox 119.0",
		},
		{
			name:            "Edge on Windows",
			userAgent:       "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36 Edg/119.0.0.0",
			expectedDevice:  "desktop",
			expectedOS:      "Windows 10/11",
			expectedBrowser: "Edge 119.0.0.0",
		},
		{
			name:            "iPad Safari",
			userAgent:       "Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
			expectedDevice:  "tablet",
			expectedOS:      "iOS 17.0",
			expectedBrowser: "Safari 17.0",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			clientInfo := &storepb.RefreshTokensUserSetting_ClientInfo{}
			service.parseUserAgent(tt.userAgent, clientInfo)

			if clientInfo.DeviceType != tt.expectedDevice {
				t.Errorf("Expected device type %s, got %s", tt.expectedDevice, clientInfo.DeviceType)
			}
			if clientInfo.Os != tt.expectedOS {
				t.Errorf("Expected OS %s, got %s", tt.expectedOS, clientInfo.Os)
			}
			if clientInfo.Browser != tt.expectedBrowser {
				t.Errorf("Expected browser %s, got %s", tt.expectedBrowser, clientInfo.Browser)
			}
		})
	}
}

func TestExtractClientInfo(t *testing.T) {
	service := &APIV1Service{}

	// Test with metadata containing user agent and IP
	md := metadata.New(map[string]string{
		"user-agent":      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
		"x-forwarded-for": "203.0.113.1, 198.51.100.1",
		"x-real-ip":       "203.0.113.1",
	})

	ctx := metadata.NewIncomingContext(context.Background(), md)

	clientInfo := service.extractClientInfo(ctx)

	if clientInfo.UserAgent == "" {
		t.Error("Expected user agent to be set")
	}
	if clientInfo.IpAddress != "203.0.113.1" {
		t.Errorf("Expected IP address to be 203.0.113.1, got %s", clientInfo.IpAddress)
	}
	if clientInfo.DeviceType != "desktop" {
		t.Errorf("Expected device type to be desktop, got %s", clientInfo.DeviceType)
	}
	if clientInfo.Os != "Windows 10/11" {
		t.Errorf("Expected OS to be Windows 10/11, got %s", clientInfo.Os)
	}
	if clientInfo.Browser != "Chrome 119.0.0.0" {
		t.Errorf("Expected browser to be Chrome 119.0.0.0, got %s", clientInfo.Browser)
	}
}

// TestClientInfoExamples demonstrates the enhanced client info extraction with various user agents.
func TestClientInfoExamples(t *testing.T) {
	service := &APIV1Service{}

	examples := []struct {
		description string
		userAgent   string
	}{
		{
			description: "Modern Chrome on Windows 11",
			userAgent:   "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
		},
		{
			description: "Safari on iPhone 15 Pro",
			userAgent:   "Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Mobile/15E148 Safari/604.1",
		},
		{
			description: "Chrome on Samsung Galaxy",
			userAgent:   "Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
		},
		{
			description: "Firefox on Ubuntu",
			userAgent:   "Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:109.0) Gecko/20100101 Firefox/120.0",
		},
		{
			description: "Edge on Windows 10",
			userAgent:   "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0",
		},
		{
			description: "Safari on iPad Air",
			userAgent:   "Mozilla/5.0 (iPad; CPU OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Mobile/15E148 Safari/604.1",
		},
	}

	for _, example := range examples {
		t.Run(example.description, func(t *testing.T) {
			clientInfo := &storepb.RefreshTokensUserSetting_ClientInfo{}
			service.parseUserAgent(example.userAgent, clientInfo)

			t.Logf("User Agent: %s", example.userAgent)
			t.Logf("Device Type: %s", clientInfo.DeviceType)
			t.Logf("Operating System: %s", clientInfo.Os)
			t.Logf("Browser: %s", clientInfo.Browser)
			t.Log("---")

			// Ensure all fields are populated
			if clientInfo.DeviceType == "" {
				t.Error("Device type should not be empty")
			}
			if clientInfo.Os == "" {
				t.Error("OS should not be empty")
			}
			if clientInfo.Browser == "" {
				t.Error("Browser should not be empty")
			}
		})
	}
}
