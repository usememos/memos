package d1

import (
	"net"
	"net/url"
	"os"
	"strings"

	"github.com/pkg/errors"
)

// DefaultEndpoint is the Cloudflare REST API base URL.
const DefaultEndpoint = "https://api.cloudflare.com/client/v4"

// AccessMode selects how the driver reaches the database.
type AccessMode string

const (
	// AccessModeREST talks to the Cloudflare REST API with an API token.
	AccessModeREST AccessMode = "rest"
	// AccessModeBridge talks to a deployment-provided Worker that holds the
	// D1 binding, so Memos needs no Cloudflare API token.
	AccessModeBridge AccessMode = "bridge"
)

// Config is the parsed form of a D1 DSN.
//
// DSN grammar:
//
//	d1://<account_id>/<database_id>?token=<api_token>[&endpoint=<base_url>]
//	d1-bridge://<host>[:<port>][/<path>][?token=<secret>][&private=true]
//
// The first form selects REST access. Its token may be omitted from the DSN
// and supplied through the CLOUDFLARE_API_TOKEN environment variable instead
// so it stays out of process listings and logs.
//
// The second form selects bridge access: the host and path name the Worker
// endpoint that implements the bridge protocol (see docs/design/cloudflare-d1.md).
// A public bridge is reached over HTTPS and requires a shared secret, sent as
// a bearer credential; the secret is best supplied through
// MEMOS_D1_BRIDGE_TOKEN rather than the DSN. private=true names a bridge on
// a platform-private path, such as the virtual host a Cloudflare Containers
// outbound handler serves or the loopback test emulator: it is reached over
// plain HTTP and the secret is optional.
type Config struct {
	Mode AccessMode

	// Private marks a bridge on a platform-private path (bridge access only).
	Private bool

	// REST access.
	AccountID  string
	DatabaseID string
	Endpoint   string

	// Bridge access.
	BridgeURL string

	// Token is the API token (REST) or the bridge bearer secret (bridge).
	Token string
}

// ParseDSN parses a d1:// or d1-bridge:// DSN.
func ParseDSN(dsn string) (*Config, error) {
	parsed, err := url.Parse(dsn)
	if err != nil {
		return nil, errors.Wrap(err, "failed to parse d1 dsn")
	}
	switch parsed.Scheme {
	case "d1":
		return parseRESTDSN(parsed)
	case "d1-bridge":
		return parseBridgeDSN(parsed)
	default:
		return nil, errors.Errorf("d1 dsn must use the d1:// or d1-bridge:// scheme, got %q", parsed.Scheme)
	}
}

func parseRESTDSN(parsed *url.URL) (*Config, error) {
	config := &Config{
		Mode:       AccessModeREST,
		AccountID:  parsed.Host,
		DatabaseID: strings.Trim(parsed.Path, "/"),
		Token:      parsed.Query().Get("token"),
		Endpoint:   strings.TrimRight(parsed.Query().Get("endpoint"), "/"),
	}
	if config.AccountID == "" {
		return nil, errors.New("d1 dsn is missing the account id: d1://<account_id>/<database_id>")
	}
	if config.DatabaseID == "" || strings.Contains(config.DatabaseID, "/") {
		return nil, errors.New("d1 dsn is missing the database id: d1://<account_id>/<database_id>")
	}
	if config.Token == "" {
		config.Token = os.Getenv("CLOUDFLARE_API_TOKEN")
	}
	if config.Token == "" {
		return nil, errors.New("d1 api token is required: add ?token=<api_token> to the dsn or set CLOUDFLARE_API_TOKEN")
	}
	if config.Endpoint == "" {
		config.Endpoint = DefaultEndpoint
	}
	if err := validateEndpoint(config.Endpoint); err != nil {
		return nil, err
	}
	return config, nil
}

func parseBridgeDSN(parsed *url.URL) (*Config, error) {
	if parsed.Host == "" {
		return nil, errors.New("d1 bridge dsn is missing the host: d1-bridge://<host>[/<path>]")
	}
	query := parsed.Query()
	config := &Config{
		Mode:    AccessModeBridge,
		Private: query.Get("private") == "true",
		Token:   query.Get("token"),
	}
	if config.Token == "" {
		config.Token = os.Getenv("MEMOS_D1_BRIDGE_TOKEN")
	}
	path := strings.TrimRight(parsed.Path, "/")
	if config.Private {
		// The platform keeps the path private, so plain HTTP carries no risk
		// and a shared secret is not needed.
		config.BridgeURL = "http://" + parsed.Host + path
		return config, nil
	}
	config.BridgeURL = "https://" + parsed.Host + path
	if config.Token == "" {
		return nil, errors.New("a public d1 bridge requires a shared secret: set MEMOS_D1_BRIDGE_TOKEN (or add ?token=) or mark a platform-private bridge with ?private=true")
	}
	return config, nil
}

// validateEndpoint rejects endpoints that would send a bearer credential in
// the clear. Plain HTTP is allowed only towards loopback, where the test
// emulator listens.
func validateEndpoint(endpoint string) error {
	parsed, err := url.Parse(endpoint)
	if err != nil {
		return errors.Wrap(err, "invalid d1 endpoint")
	}
	if parsed.Host == "" {
		return errors.Errorf("d1 endpoint %q has no host", endpoint)
	}
	switch parsed.Scheme {
	case "https":
		return nil
	case "http":
		if isLoopbackHost(parsed.Hostname()) {
			return nil
		}
		return errors.Errorf("d1 endpoint %q must use https unless it points at loopback", endpoint)
	default:
		return errors.Errorf("d1 endpoint %q must use https", endpoint)
	}
}

func isLoopbackHost(host string) bool {
	if host == "localhost" {
		return true
	}
	ip := net.ParseIP(host)
	return ip != nil && ip.IsLoopback()
}
