package api

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"net/url"
	"sync"
	"time"

	"github.com/pkg/errors"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/timestamppb"

	apipb "github.com/usememos/memos/proto/gen/api"
	storepb "github.com/usememos/memos/proto/gen/store"
	"github.com/usememos/memos/store"
)

// ssoAuthorizationStateTTL bounds how long a minted state token stays
// redeemable. It matches the client-side expiry in web/src/utils/oauth.ts.
const ssoAuthorizationStateTTL = 10 * time.Minute

// ssoAuthorizationState records the parts of an OAuth2 flow the redemption
// request must not control: which provider the flow was started for, the
// callback URI to name in the token exchange, and whether the authorization
// request carried a PKCE challenge.
type ssoAuthorizationState struct {
	identityProviderUID string
	redirectURI         string
	pkceRequired        bool
	expiresAt           time.Time
}

// ssoAuthorizationStateStore is an in-memory store of OAuth2 state tokens.
// Redeeming a token deletes it, so a token authorizes exactly one code
// exchange; a stolen code cannot be replayed through a second redemption,
// and a login flow cannot be replayed into a session that never started one.
// Tokens are process-local and live only as long as their TTL, which matches
// the single-binary deployment model.
type ssoAuthorizationStateStore struct {
	ttl    time.Duration
	mu     sync.Mutex
	states map[string]ssoAuthorizationState
}

func newSSOAuthStateStore(ttl time.Duration) *ssoAuthorizationStateStore {
	return &ssoAuthorizationStateStore{
		ttl:    ttl,
		states: map[string]ssoAuthorizationState{},
	}
}

func (s *ssoAuthorizationStateStore) issue(identityProviderUID, redirectURI string, pkceRequired bool) (string, time.Time, error) {
	var token [32]byte
	if _, err := rand.Read(token[:]); err != nil {
		return "", time.Time{}, errors.Wrap(err, "failed to generate state token")
	}
	state := hex.EncodeToString(token[:])
	expiresAt := time.Now().Add(s.ttl)

	s.mu.Lock()
	defer s.mu.Unlock()
	now := time.Now()
	for key, entry := range s.states {
		if now.After(entry.expiresAt) {
			delete(s.states, key)
		}
	}
	s.states[state] = ssoAuthorizationState{
		identityProviderUID: identityProviderUID,
		redirectURI:         redirectURI,
		pkceRequired:        pkceRequired,
		expiresAt:           expiresAt,
	}
	return state, expiresAt, nil
}

// redeem consumes a state token. A token redeems at most once, only before
// its expiry, and only for the identity provider it was issued for.
func (s *ssoAuthorizationStateStore) redeem(state, identityProviderUID string) (ssoAuthorizationState, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	entry, ok := s.states[state]
	if !ok {
		return ssoAuthorizationState{}, errors.New("unknown state token")
	}
	delete(s.states, state)
	if time.Now().After(entry.expiresAt) {
		return ssoAuthorizationState{}, errors.New("state token expired")
	}
	if entry.identityProviderUID != identityProviderUID {
		return ssoAuthorizationState{}, errors.New("state token was issued for a different identity provider")
	}
	return entry, nil
}

// ssoAuthStates lazily creates the state store so struct-literal
// constructions of APIService (tests) keep working.
func (s *APIService) ssoAuthStates() *ssoAuthorizationStateStore {
	s.ssoStateOnce.Do(func() {
		s.ssoStates = newSSOAuthStateStore(ssoAuthorizationStateTTL)
	})
	return s.ssoStates
}

func (s *APIService) CreateSSOAuthorizationState(ctx context.Context, request *apipb.CreateSSOAuthorizationStateRequest) (*apipb.CreateSSOAuthorizationStateResponse, error) {
	idpUID, err := ExtractIdentityProviderUIDFromName(request.IdentityProvider)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid identity provider name: %v", err)
	}
	identityProvider, err := s.Store.GetIdentityProvider(ctx, &store.FindIdentityProvider{
		UID: &idpUID,
	})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get identity provider, error: %v", err)
	}
	if identityProvider == nil {
		return nil, status.Errorf(codes.InvalidArgument, "identity provider not found")
	}
	if identityProvider.Type != storepb.IdentityProvider_OAUTH2 {
		return nil, status.Errorf(codes.InvalidArgument, "identity provider is not an OAuth2 provider")
	}

	redirectURI, err := url.Parse(request.RedirectUri)
	if err != nil || !redirectURI.IsAbs() || redirectURI.Host == "" || (redirectURI.Scheme != "https" && redirectURI.Scheme != "http") {
		return nil, status.Errorf(codes.InvalidArgument, "redirect_uri must be an absolute http(s) URI")
	}

	state, expiresAt, err := s.ssoAuthStates().issue(idpUID, request.RedirectUri, request.PkceRequired)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to mint SSO state: %v", err)
	}
	return &apipb.CreateSSOAuthorizationStateResponse{
		State:      state,
		ExpireTime: timestamppb.New(expiresAt),
	}, nil
}
